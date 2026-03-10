package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
)

func isActiveUntil(expiresAt *time.Time, revokedAt *time.Time) bool {
	if revokedAt != nil {
		return false
	}
	if expiresAt == nil {
		return true
	}
	return expiresAt.After(time.Now())
}

// GetAdminBans — список активных админ-банов.
func GetAdminBans(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		var list []models.AdminBan
		if err := db.Where("revoked_at IS NULL").Where("(expires_at IS NULL OR expires_at > ?)", now).
			Order("created_at DESC").Limit(500).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, 0, len(list))
		for _, b := range list {
			out = append(out, gin.H{
				"id":       b.ID,
				"userId":   b.UserID,
				"username": b.Username,
				"reason":   b.Reason,
				"bannedBy": b.AdminID,
				"bannedAt": b.CreatedAt.Unix() * 1000,
				"expiresAt": func() interface{} {
					if b.ExpiresAt != nil {
						return b.ExpiresAt.Unix() * 1000
					}
					return nil
				}(),
				"permanent": b.ExpiresAt == nil,
				"active":    true,
			})
		}
		c.JSON(http.StatusOK, gin.H{"bans": out})
	}
}

// CreateAdminBan — создать админ-бан и выставить статус пользователя banned.
func CreateAdminBan(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			UserID    string `json:"userId" binding:"required"`
			Reason    string `json:"reason"`
			Permanent bool   `json:"permanent"`
			ExpiresAt *int64 `json:"expiresAt"` // ms epoch
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		if body.UserID == adminIDStr {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_block_self"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", body.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		for _, role := range user.ParseRoles() {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_block_owner"})
				return
			}
		}

		var exp *time.Time
		if !body.Permanent && body.ExpiresAt != nil {
			t := time.Unix(0, (*body.ExpiresAt)*int64(time.Millisecond)).UTC()
			exp = &t
		}

		// revoke previous active bans for cleanliness
		now := time.Now().UTC()
		db.Model(&models.AdminBan{}).
			Where("user_id = ? AND revoked_at IS NULL", body.UserID).
			Where("(expires_at IS NULL OR expires_at > ?)", now).
			Update("revoked_at", now)

		rec := models.AdminBan{
			ID:        uuid.New().String(),
			UserID:    body.UserID,
			Username:  user.Username,
			Reason:    body.Reason,
			AdminID:   adminIDStr,
			ExpiresAt: exp,
		}
		if err := db.Create(&rec).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		db.Model(&user).Updates(map[string]interface{}{"status": "banned", "roles": "[]"})
		logRoleBanHistory(db, body.UserID, adminIDStr, "ban", user.Roles, "[]", body.Reason)
		logAdminAudit(db, adminIDStr, body.UserID, "block_user", body.Reason, c.ClientIP(), c.GetHeader("User-Agent"))
		recordSuspiciousActivity(db, user.ID, "account_locked", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"reason":    body.Reason,
			"permanent": body.Permanent,
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			reason := body.Reason
			if reason == "" {
				reason = "Доступ к аккаунту временно ограничен администрацией."
			}
			queueEmailJob("account_locked", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendAccountLockedNotification(emailAddress, user.Username, reason, supportCenterURL())
			})
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "id": rec.ID})
	}
}

// DeleteAdminBan — снять бан (id в URL — id записи или userId).
func DeleteAdminBan(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		now := time.Now().UTC()

		var ban models.AdminBan
		if err := db.First(&ban, "id = ?", id).Error; err != nil {
			// fallback: treat as userId
			if err2 := db.Where("user_id = ? AND revoked_at IS NULL", id).Order("created_at DESC").First(&ban).Error; err2 != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
				return
			}
		}
		if !isActiveUntil(ban.ExpiresAt, ban.RevokedAt) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
			return
		}
		db.Model(&ban).Update("revoked_at", now)

		var user models.User
		if err := db.First(&user, "id = ?", ban.UserID).Error; err == nil {
			db.Model(&user).Update("status", "online")
		}
		logRoleBanHistory(db, ban.UserID, adminIDStr, "unban", "banned", "online", "admin_unban")
		logAdminAudit(db, adminIDStr, ban.UserID, "unblock_user", "admin_unban", c.ClientIP(), c.GetHeader("User-Agent"))
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminMutes — список активных мутов.
func GetAdminMutes(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		var list []models.AdminMute
		if err := db.Where("revoked_at IS NULL").Where("(expires_at IS NULL OR expires_at > ?)", now).
			Order("created_at DESC").Limit(500).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, 0, len(list))
		for _, m := range list {
			out = append(out, gin.H{
				"id":       m.ID,
				"userId":   m.UserID,
				"username": m.Username,
				"chatId":   m.ChatID,
				"chatName": m.ChatName,
				"reason":   m.Reason,
				"mutedBy":  m.AdminID,
				"mutedAt":  m.CreatedAt.Unix() * 1000,
				"expiresAt": func() interface{} {
					if m.ExpiresAt != nil {
						return m.ExpiresAt.Unix() * 1000
					}
					return nil
				}(),
				"permanent": m.ExpiresAt == nil,
				"active":    true,
			})
		}
		c.JSON(http.StatusOK, gin.H{"mutes": out})
	}
}

// CreateAdminMute — создать мут для пользователя в чате.
func CreateAdminMute(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			UserID    string `json:"userId" binding:"required"`
			ChatID    string `json:"chatId" binding:"required"`
			Reason    string `json:"reason"`
			Permanent bool   `json:"permanent"`
			ExpiresAt *int64 `json:"expiresAt"` // ms epoch
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)

		var user models.User
		if err := db.First(&user, "id = ?", body.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		var chat models.Chat
		_ = db.First(&chat, "id = ?", body.ChatID).Error

		var exp *time.Time
		if !body.Permanent && body.ExpiresAt != nil {
			t := time.Unix(0, (*body.ExpiresAt)*int64(time.Millisecond)).UTC()
			exp = &t
		}

		now := time.Now().UTC()
		db.Model(&models.AdminMute{}).
			Where("user_id = ? AND chat_id = ? AND revoked_at IS NULL", body.UserID, body.ChatID).
			Where("(expires_at IS NULL OR expires_at > ?)", now).
			Update("revoked_at", now)

		rec := models.AdminMute{
			ID:        uuid.New().String(),
			UserID:    body.UserID,
			Username:  user.Username,
			ChatID:    body.ChatID,
			ChatName:  chat.Name,
			Reason:    body.Reason,
			AdminID:   adminIDStr,
			ExpiresAt: exp,
		}
		if err := db.Create(&rec).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		logModeration(db, body.ChatID, "", adminIDStr, "admin_mute", body.UserID, "", gin.H{"reason": body.Reason})
		logAdminAudit(db, adminIDStr, body.UserID, "mute_user", body.Reason, c.ClientIP(), c.GetHeader("User-Agent"))
		c.JSON(http.StatusOK, gin.H{"ok": true, "id": rec.ID})
	}
}

// DeleteAdminMute — снять мут (id в URL — id записи).
func DeleteAdminMute(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		now := time.Now().UTC()
		var rec models.AdminMute
		if err := db.First(&rec, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if rec.RevokedAt == nil {
			db.Model(&rec).Update("revoked_at", now)
			logModeration(db, rec.ChatID, "", adminIDStr, "admin_unmute", rec.UserID, "", nil)
			logAdminAudit(db, adminIDStr, rec.UserID, "unmute_user", "admin_unmute", c.ClientIP(), c.GetHeader("User-Agent"))
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminModerationHistory — единая история банов/мутов из админки.
func GetAdminModerationHistory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 200
		now := time.Now()
		var bans []models.AdminBan
		var mutes []models.AdminMute
		_ = db.Where("created_at > ?", now.AddDate(0, 0, -90)).Order("created_at DESC").Limit(limit).Find(&bans).Error
		_ = db.Where("created_at > ?", now.AddDate(0, 0, -90)).Order("created_at DESC").Limit(limit).Find(&mutes).Error

		type item struct {
			kind string
			ts   time.Time
			obj  gin.H
		}
		items := make([]item, 0, len(bans)+len(mutes))
		for _, b := range bans {
			items = append(items, item{
				kind: "ban",
				ts:   b.CreatedAt,
				obj: gin.H{
					"type":     "ban",
					"id":       b.ID,
					"userId":   b.UserID,
					"username": b.Username,
					"reason":   b.Reason,
					"bannedBy": b.AdminID,
					"bannedAt": b.CreatedAt.Unix() * 1000,
					"expiresAt": func() interface{} {
						if b.ExpiresAt != nil {
							return b.ExpiresAt.Unix() * 1000
						}
						return nil
					}(),
					"permanent": b.ExpiresAt == nil,
					"active":    isActiveUntil(b.ExpiresAt, b.RevokedAt),
				},
			})
		}
		for _, m := range mutes {
			items = append(items, item{
				kind: "mute",
				ts:   m.CreatedAt,
				obj: gin.H{
					"type":     "mute",
					"id":       m.ID,
					"userId":   m.UserID,
					"username": m.Username,
					"chatId":   m.ChatID,
					"chatName": m.ChatName,
					"reason":   m.Reason,
					"mutedBy":  m.AdminID,
					"mutedAt":  m.CreatedAt.Unix() * 1000,
					"expiresAt": func() interface{} {
						if m.ExpiresAt != nil {
							return m.ExpiresAt.Unix() * 1000
						}
						return nil
					}(),
					"permanent": m.ExpiresAt == nil,
					"active":    isActiveUntil(m.ExpiresAt, m.RevokedAt),
				},
			})
		}

		// sort by ts desc
		for i := 0; i < len(items); i++ {
			for j := i + 1; j < len(items); j++ {
				if items[j].ts.After(items[i].ts) {
					items[i], items[j] = items[j], items[i]
				}
			}
		}
		if len(items) > limit {
			items = items[:limit]
		}
		h := make([]gin.H, 0, len(items))
		for _, it := range items {
			h = append(h, it.obj)
		}
		c.JSON(http.StatusOK, gin.H{"history": h})
	}
}
