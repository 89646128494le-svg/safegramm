package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/websocket"
)

func isChatModerator(role string) bool {
	return role == "owner" || role == "admin" || role == "moderator"
}

// GetChatModerationSettings получить настройки автомодерации (модераторы)
func GetChatModerationSettings(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// обычные участники тоже могут видеть, включена ли модерация (для UX)
		var settings models.ChatModerationSettings
		if err := db.Where("chat_id = ?", chatID).First(&settings).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"settings": gin.H{"chatId": chatID, "enabled": false}})
			return
		}
		c.JSON(http.StatusOK, gin.H{"settings": settings, "canEdit": isChatModerator(member.Role)})
	}
}

// UpdateChatModerationSettings обновить настройки (owner/admin/moderator)
func UpdateChatModerationSettings(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req models.ChatModerationSettings
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var settings models.ChatModerationSettings
		if err := db.Where("chat_id = ?", chatID).First(&settings).Error; err != nil {
			settings = models.ChatModerationSettings{ID: uuid.New().String(), ChatID: chatID}
			db.Create(&settings)
		}

		settings.Enabled = req.Enabled
		settings.BannedWords = req.BannedWords
		if req.MaxMsgsPer10s > 0 {
			settings.MaxMsgsPer10s = req.MaxMsgsPer10s
		}
		if req.WarnThreshold > 0 {
			settings.WarnThreshold = req.WarnThreshold
		}
		if req.BanMinutes > 0 {
			settings.BanMinutes = req.BanMinutes
		}
		settings.QueueOnViolation = req.QueueOnViolation

		db.Save(&settings)
		logModeration(db, chatID, "", userIDStr, "moderation_settings_update", "", "", gin.H{"enabled": settings.Enabled})
		c.JSON(http.StatusOK, gin.H{"settings": settings})
	}
}

// GetModerationQueue список сообщений в мод-очереди
func GetModerationQueue(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var messages []models.Message
		db.Where("chat_id = ? AND moderation_status = 'pending'", chatID).
			Preload("Sender").
			Order("created_at ASC").
			Limit(200).
			Find(&messages)

		c.JSON(http.StatusOK, gin.H{"messages": messages})
	}
}

// ApproveMessage одобрить сообщение из очереди и отправить в WS
func ApproveMessage(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var msg models.Message
		if err := db.Preload("Sender").First(&msg, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", msg.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		msg.ModerationStatus = "approved"
		msg.ModerationReason = ""
		db.Save(&msg)

		// WS broadcast (как обычное сообщение)
		response := gin.H{
			"id":               msg.ID,
			"chatId":           msg.ChatID,
			"senderId":         msg.SenderID,
			"text":             msg.Text,
			"ciphertext":       msg.Ciphertext,
			"moderationStatus": msg.ModerationStatus,
			"createdAt":        msg.CreatedAt,
			"sender": gin.H{
				"id":       msg.Sender.ID,
				"username": msg.Sender.Username,
				"avatarUrl": msg.Sender.AvatarURL,
			},
		}
		wsMessage := gin.H{"type": "message", "data": response}
		b, _ := json.Marshal(wsMessage)
		wsHub.BroadcastToChat(msg.ChatID, b)

		logModeration(db, msg.ChatID, "", userIDStr, "moderation_approve", "", msg.ID, nil)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// RejectMessage отклонить сообщение
func RejectMessage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct{ Reason string `json:"reason"` }
		_ = c.ShouldBindJSON(&req)

		var msg models.Message
		if err := db.First(&msg, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", msg.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		msg.ModerationStatus = "rejected"
		if req.Reason != "" {
			msg.ModerationReason = req.Reason
		}
		db.Save(&msg)
		logModeration(db, msg.ChatID, "", userIDStr, "moderation_reject", msg.SenderID, msg.ID, gin.H{"reason": msg.ModerationReason})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// BanUser временный бан пользователя в чате (модераторы)
func BanUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		actorID, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, actorID).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			UserID    string `json:"userId" binding:"required"`
			Minutes   int    `json:"minutes"`
			Reason    string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		mins := req.Minutes
		if mins <= 0 {
			mins = 10
		}
		exp := time.Now().Add(time.Duration(mins) * time.Minute)
		_ = db.Create(&models.ChatBan{
			ID:        uuid.New().String(),
			ChatID:    chatID,
			UserID:    req.UserID,
			ActorID:   actorID,
			Reason:    req.Reason,
			ExpiresAt: &exp,
		}).Error

		logMemberEvent(db, "chat", chatID, req.UserID, actorID, "ban", gin.H{"expiresAt": exp, "reason": req.Reason})
		logModeration(db, chatID, "", actorID, "ban", req.UserID, "", gin.H{"expiresAt": exp, "reason": req.Reason})
		c.JSON(http.StatusOK, gin.H{"ok": true, "expiresAt": exp})
	}
}

// UnbanUser снимает бан (модераторы)
func UnbanUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		actorID, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, actorID).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct{ UserID string `json:"userId" binding:"required"` }
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		db.Where("chat_id = ? AND user_id = ?", chatID, req.UserID).Delete(&models.ChatBan{})
		logMemberEvent(db, "chat", chatID, req.UserID, actorID, "unban", nil)
		logModeration(db, chatID, "", actorID, "unban", req.UserID, "", nil)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetModerationLogs логи модерации для чата
func GetModerationLogs(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var logs []models.ModerationLog
		db.Where("chat_id = ?", chatID).Order("created_at DESC").Limit(300).Find(&logs)
		c.JSON(http.StatusOK, gin.H{"logs": logs})
	}
}

