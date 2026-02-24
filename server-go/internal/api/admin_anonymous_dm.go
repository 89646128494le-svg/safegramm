package api

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/websocket"
)

const (
	// SupportSystemUserID — ID системного пользователя «Поддержка» для анонимных сообщений от админа.
	SupportSystemUserID = "00000000-0000-0000-0000-000000000001"
)

var supportSenderDisplay = gin.H{
	"id":        "support",
	"username":  "Поддержка",
	"avatarUrl": "",
}

// EnsureSupportUser создаёт системного пользователя «Поддержка», если его ещё нет.
func EnsureSupportUser(db *gorm.DB) error {
	var u models.User
	err := db.First(&u, "id = ?", SupportSystemUserID).Error
	if err == nil {
		return nil
	}
	u = models.User{
		ID:       SupportSystemUserID,
		Username: "Поддержка",
		PassHash: "system",
		Salt:     "system",
	}
	return db.Create(&u).Error
}

// getOrCreateAnonymousSupportChat возвращает чат типа anonymous_support для целевого пользователя (создаёт при необходимости).
func getOrCreateAnonymousSupportChat(db *gorm.DB, targetUserID string) (*models.Chat, bool, error) {
	if err := EnsureSupportUser(db); err != nil {
		return nil, false, err
	}
	// Ищем существующий чат: type=anonymous_support и единственный участник — targetUserID
	var chat models.Chat
	err := db.Where("type = ?", "anonymous_support").
		Where("id IN (SELECT chat_id FROM chat_members WHERE user_id = ? AND deleted_at IS NULL)", targetUserID).
		Where("id NOT IN (SELECT chat_id FROM chat_members WHERE user_id != ? AND deleted_at IS NULL)", targetUserID).
		First(&chat).Error
	if err == nil {
		return &chat, false, nil
	}
	chatID := uuid.New().String()
	chat = models.Chat{
		ID:        chatID,
		Type:      "anonymous_support",
		Name:      "Анонимная поддержка",
		CreatedBy: SupportSystemUserID,
		InviteLink: "anon-" + chatID,
	}
	if err := db.Create(&chat).Error; err != nil {
		return nil, false, err
	}
	member := models.ChatMember{
		ID:     uuid.New().String(),
		ChatID: chat.ID,
		UserID: targetUserID,
		Role:   "member",
	}
	if err := db.Create(&member).Error; err != nil {
		return nil, false, err
	}
	return &chat, true, nil
}

// AdminGetAnonymousChat возвращает чат и сообщения анонимной поддержки для целевого пользователя (только для админа).
func AdminGetAnonymousChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		targetUserID := c.Param("targetUserId")
		if targetUserID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "targetUserId required"})
			return
		}
		var target models.User
		if err := db.First(&target, "id = ?", targetUserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
			return
		}
		chat, _, err := getOrCreateAnonymousSupportChat(db, targetUserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		var messages []models.Message
		if err := db.Where("chat_id = ? AND deleted_at IS NULL", chat.ID).
			Preload("Sender").
			Order("created_at ASC").
			Find(&messages).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		result := make([]gin.H, 0, len(messages))
		for _, msg := range messages {
			senderID := msg.SenderID
			sender := gin.H{"id": msg.Sender.ID, "username": msg.Sender.Username, "avatarUrl": msg.Sender.AvatarURL}
			if msg.SenderID == SupportSystemUserID {
				senderID = "support"
				sender = supportSenderDisplay
			}
			result = append(result, gin.H{
				"id":       msg.ID,
				"chatId":   msg.ChatID,
				"senderId": senderID,
				"sender":   sender,
				"text":     msg.Text,
				"createdAt": msg.CreatedAt,
			})
		}
		c.JSON(http.StatusOK, gin.H{
			"chat": gin.H{
				"id":   chat.ID,
				"name": chat.Name,
				"type": chat.Type,
			},
			"targetUser": gin.H{
				"id":       target.ID,
				"username": target.Username,
				"email":    func() string { if target.Email != nil { return *target.Email }; return "" }(),
			},
			"messages": result,
		})
	}
}

// AdminSendAnonymousDM отправляет сообщение от имени «Поддержка» в анонимный чат с пользователем.
func AdminSendAnonymousDM(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			TargetUserID string `json:"targetUserId" binding:"required"`
			Text         string `json:"text" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if err := EnsureSupportUser(db); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		chat, _, err := getOrCreateAnonymousSupportChat(db, req.TargetUserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		messageID := uuid.New().String()
		msg := models.Message{
			ID:              messageID,
			ChatID:          chat.ID,
			SenderID:        SupportSystemUserID,
			Text:            req.Text,
			ModerationStatus: "approved",
		}
		if err := db.Create(&msg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		// Ответ для API и для WS: получатель видит отправителя как «Поддержка»
		response := gin.H{
			"id":       msg.ID,
			"chatId":   msg.ChatID,
			"senderId": "support",
			"sender":   supportSenderDisplay,
			"text":     msg.Text,
			"createdAt": msg.CreatedAt,
		}
		messageJSON, _ := json.Marshal(gin.H{"type": "message", "message": response})
		wsHub.BroadcastToChat(chat.ID, messageJSON)
		c.JSON(http.StatusOK, response)
	}
}
