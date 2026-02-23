package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetAdminMessagesSearch — глобальный поиск по сообщениям (текст, отправитель, чат)
func GetAdminMessagesSearch(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		senderID := c.Query("senderId")
		chatID := c.Query("chatId")
		limit := 50
		tx := db.Model(&models.Message{}).Where("deleted_at IS NULL")
		if q != "" {
			tx = tx.Where("text LIKE ?", "%"+q+"%")
		}
		if senderID != "" {
			tx = tx.Where("sender_id = ?", senderID)
		}
		if chatID != "" {
			tx = tx.Where("chat_id = ?", chatID)
		}
		var list []models.Message
		if err := tx.Order("created_at DESC").Limit(limit).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, m := range list {
			out[i] = gin.H{
				"id":         m.ID,
				"chatId":     m.ChatID,
				"senderId":   m.SenderID,
				"text":       m.Text,
				"attachmentUrl": m.AttachmentURL,
				"moderationStatus": m.ModerationStatus,
				"createdAt":  m.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"messages": out})
	}
}

// GetAdminMediaQueue — очередь медиа на проверку (pending, с вложениями)
func GetAdminMediaQueue(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.Message
		if err := db.Where("moderation_status = ? AND (attachment_url != '' OR gif_url != '')", "pending").
			Order("created_at ASC").Limit(100).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, m := range list {
			url := m.AttachmentURL
			if url == "" {
				url = m.GifURL
			}
			out[i] = gin.H{
				"id":             m.ID,
				"chatId":         m.ChatID,
				"senderId":       m.SenderID,
				"attachmentUrl":  url,
				"moderationStatus": m.ModerationStatus,
				"createdAt":      m.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"queue": out})
	}
}

// PostAdminMessageModeration — одобрить/отклонить сообщение (id = messageId)
func PostAdminMessageModeration(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		msgID := c.Param("id")
		var req struct {
			Status string `json:"status"` // approved, rejected
			Reason string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if req.Status != "approved" && req.Status != "rejected" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		var msg models.Message
		if err := db.First(&msg, "id = ?", msgID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		db.Model(&msg).Updates(map[string]interface{}{
			"moderation_status": req.Status,
			"moderation_reason": req.Reason,
		})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminStickerPacks — стикерпаки на модерации (или все)
func GetAdminStickerPacks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status") // pending, approved, all
		tx := db.Model(&models.StickerPack{})
		if status == "pending" {
			tx = tx.Where("approved_at IS NULL AND rejected_at IS NULL AND created_by_user_id != ''")
		} else if status == "approved" {
			tx = tx.Where("approved_at IS NOT NULL")
		}
		var list []models.StickerPack
		if err := tx.Order("created_at DESC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, p := range list {
			out[i] = gin.H{
				"id":               p.ID,
				"name":             p.Name,
				"title":            p.Title,
				"thumbnailUrl":     p.ThumbnailURL,
				"createdByUserId":  p.CreatedByUserID,
				"approvedAt":       p.ApprovedAt,
				"rejectedAt":      p.RejectedAt,
				"createdAt":        p.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"packs": out})
	}
}

// PostAdminStickerPackApprove — одобрить стикерпак
func PostAdminStickerPackApprove(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var pack models.StickerPack
		if err := db.First(&pack, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		now := time.Now().UTC()
		db.Model(&pack).Updates(map[string]interface{}{"approved_at": now, "rejected_at": nil})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// PostAdminStickerPackReject — отклонить стикерпак
func PostAdminStickerPackReject(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var pack models.StickerPack
		if err := db.First(&pack, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		now := time.Now().UTC()
		db.Model(&pack).Updates(map[string]interface{}{"rejected_at": now, "approved_at": nil})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminBannedWords — список запрещённых слов
func GetAdminBannedWords(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.BannedWord
		if err := db.Order("created_at DESC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, w := range list {
			out[i] = gin.H{
				"id":        w.ID,
				"phrase":    w.Phrase,
				"isRegex":   w.IsRegex,
				"action":    w.Action,
				"scope":     w.Scope,
				"active":    w.Active,
				"createdBy": w.CreatedBy,
				"createdAt": w.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": out})
	}
}

// PostAdminBannedWord — добавить запрещённое слово
func PostAdminBannedWord(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		var req struct {
			Phrase  string `json:"phrase"`
			IsRegex bool   `json:"isRegex"`
			Action  string `json:"action"` // warn, ban, delete_message
			Scope   string `json:"scope"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Phrase == "" || req.Action == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if req.Scope == "" {
			req.Scope = "global"
		}
		w := models.BannedWord{
			ID:        uuid.New().String(),
			Phrase:    strings.TrimSpace(req.Phrase),
			IsRegex:   req.IsRegex,
			Action:    req.Action,
			Scope:     req.Scope,
			Active:    true,
			CreatedBy: adminIDStr,
		}
		if err := db.Create(&w).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"item": gin.H{"id": w.ID, "phrase": w.Phrase, "action": w.Action, "active": w.Active}})
	}
}

// PatchAdminBannedWord — обновить (active, action)
func PatchAdminBannedWord(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Active *bool   `json:"active"`
			Action *string `json:"action"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		var w models.BannedWord
		if err := db.First(&w, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if req.Active != nil {
			w.Active = *req.Active
		}
		if req.Action != nil {
			w.Action = *req.Action
		}
		db.Save(&w)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeleteAdminBannedWord — удалить
func DeleteAdminBannedWord(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if db.Delete(&models.BannedWord{}, "id = ?", id).RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
