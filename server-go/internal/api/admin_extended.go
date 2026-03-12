package api

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
	sgws "safegram-server/internal/websocket"
)

// AdminUsersBulk — массовые действия: block, unblock, suspend, unsuspend, promote, demote, set_plan
func AdminUsersBulk(db *gorm.DB, wsHub *sgws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserIDs []string `json:"userIds"`
			Action  string   `json:"action"` // block, unblock, suspend, unsuspend, promote, demote, set_plan
			Value   string   `json:"value"`  // для set_plan: free|premium
		}
		if err := c.ShouldBindJSON(&req); err != nil || len(req.UserIDs) == 0 || req.Action == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		done := 0
		for _, userID := range req.UserIDs {
			var user models.User
			if err := db.First(&user, "id = ?", userID).Error; err != nil {
				continue
			}
			if userID == adminIDStr && (req.Action == "block" || req.Action == "demote") {
				continue
			}
			roles := user.ParseRoles()
			hasOwner := false
			for _, r := range roles {
				if r == "owner" {
					hasOwner = true
					break
				}
			}
			if hasOwner {
				continue
			}
			oldRoles := user.Roles
			oldStatus := user.Status
			switch req.Action {
			case "block":
				db.Model(&user).Updates(map[string]interface{}{"status": "banned", "roles": "[]"})
				revokeRealtimeAccess(db, wsHub, user.ID)
				logRoleBanHistory(db, userID, adminIDStr, "ban", oldRoles, "[]", "bulk")
				logAdminAudit(db, adminIDStr, userID, "block_user", "", c.ClientIP(), c.GetHeader("User-Agent"))
				recordSuspiciousActivity(db, user.ID, "account_locked", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
					"reason": "bulk_admin_block",
				})
				if emailAddress := userEmailValue(&user); emailAddress != "" {
					queueEmailJob("account_locked_bulk", map[string]interface{}{
						"userId": user.ID,
						"email":  maskEmail(emailAddress),
					}, func() error {
						return email.SendAccountLockedNotification(emailAddress, user.Username, "Доступ к аккаунту ограничен администрацией.", supportCenterURL())
					})
				}
				done++
			case "unblock":
				db.Model(&user).Update("status", "online")
				logRoleBanHistory(db, userID, adminIDStr, "unban", oldStatus, "online", "bulk")
				logAdminAudit(db, adminIDStr, userID, "unblock_user", "", c.ClientIP(), c.GetHeader("User-Agent"))
				done++
			case "suspend":
				if !isUserSuspendedStatus(user.Status) && !isUserBannedStatus(user.Status) {
					db.Model(&user).Update("status", userStatusSuspended)
					revokeRealtimeAccess(db, wsHub, user.ID)
					logRoleBanHistory(db, userID, adminIDStr, "suspend", oldStatus, userStatusSuspended, "bulk")
					logAdminAudit(db, adminIDStr, userID, "suspend_user", "", c.ClientIP(), c.GetHeader("User-Agent"))
					done++
				}
			case "unsuspend":
				if isUserSuspendedStatus(user.Status) {
					db.Model(&user).Update("status", "online")
					logRoleBanHistory(db, userID, adminIDStr, "unsuspend", oldStatus, "online", "bulk")
					logAdminAudit(db, adminIDStr, userID, "unsuspend_user", "", c.ClientIP(), c.GetHeader("User-Agent"))
					done++
				}
			case "promote":
				hasAdmin := false
				for _, r := range roles {
					if r == "admin" || r == "sysadmin" {
						hasAdmin = true
						break
					}
				}
				if !hasAdmin {
					roles = append(roles, "admin")
					user.SetRoles(roles)
					db.Model(&user).Update("roles", user.Roles)
					logRoleBanHistory(db, userID, adminIDStr, "role_add", oldRoles, user.Roles, "bulk")
					logAdminAudit(db, adminIDStr, userID, "promote", "", c.ClientIP(), c.GetHeader("User-Agent"))
					done++
				}
			case "demote":
				newRoles := []string{}
				for _, r := range roles {
					if r != "admin" && r != "sysadmin" {
						newRoles = append(newRoles, r)
					}
				}
				user.SetRoles(newRoles)
				db.Model(&user).Update("roles", user.Roles)
				logRoleBanHistory(db, userID, adminIDStr, "role_remove", oldRoles, user.Roles, "bulk")
				logAdminAudit(db, adminIDStr, userID, "demote", "", c.ClientIP(), c.GetHeader("User-Agent"))
				done++
			case "set_plan":
				if req.Value == "free" || req.Value == "premium" {
					db.Model(&user).Update("plan", req.Value)
					logAdminAudit(db, adminIDStr, userID, "set_plan", req.Value, c.ClientIP(), c.GetHeader("User-Agent"))
					done++
				}
			}
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "processed": done})
	}
}

// GetAdminUserHistory — история смены ролей и банов по пользователю
func GetAdminUserHistory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var list []models.RoleBanHistory
		if err := db.Where("user_id = ?", userID).Order("created_at DESC").Limit(100).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, h := range list {
			out[i] = gin.H{
				"id":        h.ID,
				"adminId":   h.AdminID,
				"action":    h.Action,
				"oldValue":  h.OldValue,
				"newValue":  h.NewValue,
				"reason":    h.Reason,
				"createdAt": h.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"history": out})
	}
}

// GetAdminUsersExport — экспорт пользователей в CSV
func GetAdminUsersExport(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := db.Model(&models.User{})
		if plan := c.Query("plan"); plan != "" {
			q = q.Where("plan = ?", plan)
		}
		var users []models.User
		if err := q.Order("created_at DESC").Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=users-"+time.Now().Format("20060102")+".csv")
		w := csv.NewWriter(c.Writer)
		_ = w.Write([]string{"id", "username", "email", "roles", "plan", "status", "createdAt", "lastSeen"})
		for _, u := range users {
			email := ""
			if u.Email != nil {
				email = *u.Email
			}
			lastSeen := ""
			if u.LastSeen != nil {
				lastSeen = u.LastSeen.Format(time.RFC3339)
			}
			_ = w.Write([]string{u.ID, u.Username, email, u.Roles, u.Plan, u.Status, u.CreatedAt.Format(time.RFC3339), lastSeen})
		}
		w.Flush()
	}
}

// GetAdminUserRecoveryCodes — просмотр резервных кодов пользователя (админ)
func GetAdminUserRecoveryCodes(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		codes := user.ParseRecoveryCodes()
		c.JSON(http.StatusOK, gin.H{"codes": codes, "userId": userID})
	}
}

// PostAdminUserRecoveryCodesReset — сброс и генерация новых recovery codes для пользователя
func PostAdminUserRecoveryCodesReset(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		newCodes := make([]string, 10)
		for i := range newCodes {
			newCodes[i] = uuid.New().String()[:8] + "-" + uuid.New().String()[:8]
		}
		user.SetRecoveryCodes(newCodes)
		db.Model(&user).Update("recovery_codes", user.RecoveryCodes)
		recordSuspiciousActivity(db, user.ID, "recovery_codes_generated", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"regeneratedByAdmin": true,
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			codesPayload := strings.Join(newCodes, "\n")
			queueEmailJob("backup_codes_regenerated_admin", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendBackupCodesRegenerated(emailAddress, user.Username, codesPayload)
			})
		}
		adminID, _ := c.Get("userID")
		if aid, ok := adminID.(string); ok {
			logAdminAudit(db, aid, userID, "recovery_codes_reset", "", c.ClientIP(), c.GetHeader("User-Agent"))
		}
		c.JSON(http.StatusOK, gin.H{"codes": newCodes, "userId": userID})
	}
}

// GetAdminAuditLog — лог действий админов с фильтрами
func GetAdminAuditLog(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := db.Model(&models.AdminAuditLog{})
		if adminID := c.Query("adminId"); adminID != "" {
			q = q.Where("admin_id = ?", adminID)
		}
		if targetID := c.Query("targetId"); targetID != "" {
			q = q.Where("target_id = ?", targetID)
		}
		if action := c.Query("action"); action != "" {
			q = q.Where("action = ?", action)
		}
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
		if limit > 500 {
			limit = 500
		}
		var list []models.AdminAuditLog
		if err := q.Order("created_at DESC").Limit(limit).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, e := range list {
			out[i] = gin.H{
				"id":        e.ID,
				"adminId":   e.AdminID,
				"targetId":  e.TargetID,
				"action":    e.Action,
				"details":   e.Details,
				"ip":        e.IP,
				"createdAt": e.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"log": out})
	}
}

// GetAdminPreferences — избранные вкладки и тема админки (храним в отдельной таблице или возвращаем дефолт)
func GetAdminPreferences(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Можно завести таблицу admin_preferences (admin_id, key, value). Пока возвращаем дефолт.
		c.JSON(http.StatusOK, gin.H{
			"favoriteTabs": []string{},
			"theme":        "system",
		})
	}
}

// PatchAdminPreferences — сохранить избранные вкладки и тему
func PatchAdminPreferences(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			FavoriteTabs []string `json:"favoriteTabs"`
			Theme        string   `json:"theme"` // light, dark, system
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		// TODO: persist to admin_preferences table
		c.JSON(http.StatusOK, gin.H{"ok": true, "favoriteTabs": req.FavoriteTabs, "theme": req.Theme})
	}
}

// GetAdminGlobalSearch — глобальный поиск по админке: пользователь, чат, жалоба по ID или имени
func GetAdminGlobalSearch(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if len(q) < 2 {
			c.JSON(http.StatusOK, gin.H{"users": []gin.H{}, "chats": []gin.H{}, "reports": []gin.H{}})
			return
		}
		like := "%" + q + "%"
		var users []models.User
		db.Where("username LIKE ? OR id = ?", like, q).Limit(10).Find(&users)
		userList := make([]gin.H, len(users))
		for i, u := range users {
			userList[i] = gin.H{"id": u.ID, "username": u.Username, "email": func() string {
				if u.Email != nil {
					return *u.Email
				}
				return ""
			}()}
		}
		var chats []models.Chat
		db.Where("name LIKE ? OR id = ?", like, q).Limit(10).Find(&chats)
		chatList := make([]gin.H, len(chats))
		for i, ch := range chats {
			chatList[i] = gin.H{"id": ch.ID, "name": ch.Name, "type": ch.Type}
		}
		var reports []models.Feedback
		db.Where("subject LIKE ? OR body LIKE ? OR id = ?", like, like, q).Limit(10).Find(&reports)
		reportList := make([]gin.H, len(reports))
		for i, r := range reports {
			reportList[i] = gin.H{"id": r.ID, "userId": r.UserID, "subject": r.Subject, "createdAt": r.CreatedAt}
		}
		c.JSON(http.StatusOK, gin.H{"users": userList, "chats": chatList, "reports": reportList})
	}
}
