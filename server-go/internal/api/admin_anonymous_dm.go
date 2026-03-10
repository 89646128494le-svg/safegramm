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

const (
	// SupportSystemUserID is the system user used to present support replies anonymously.
	SupportSystemUserID = "00000000-0000-0000-0000-000000000001"
)

var supportSenderDisplay = gin.H{
	"id":        "support",
	"username":  "Поддержка",
	"avatarUrl": "",
}

func EnsureSupportUser(db *gorm.DB) error {
	var user models.User
	err := db.First(&user, "id = ?", SupportSystemUserID).Error
	if err == nil {
		return nil
	}

	user = models.User{
		ID:       SupportSystemUserID,
		Username: "Поддержка",
		PassHash: "system",
		Salt:     "system",
	}
	return db.Create(&user).Error
}

func getOrCreateAnonymousSupportChat(db *gorm.DB, targetUserID string) (*models.Chat, bool, error) {
	if err := EnsureSupportUser(db); err != nil {
		return nil, false, err
	}

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
		ID:         chatID,
		Type:       "anonymous_support",
		Name:       "Анонимная поддержка",
		CreatedBy:  SupportSystemUserID,
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
				"id":        msg.ID,
				"chatId":    msg.ChatID,
				"senderId":  senderID,
				"sender":    sender,
				"text":      msg.Text,
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
				"email": func() string {
					if target.Email != nil {
						return *target.Email
					}
					return ""
				}(),
			},
			"messages": result,
		})
	}
}

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

		msg := models.Message{
			ID:               uuid.New().String(),
			ChatID:           chat.ID,
			SenderID:         SupportSystemUserID,
			Text:             req.Text,
			ModerationStatus: "approved",
		}
		if err := db.Create(&msg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		now := time.Now().UTC()
		var latestTicket models.Feedback
		if err := db.Where("user_id = ? AND status IN ?", req.TargetUserID, []string{"open", "in_progress", "waiting_user"}).
			Order("updated_at DESC, created_at DESC").
			First(&latestTicket).Error; err == nil {
			_ = db.Model(&models.Feedback{}).Where("id = ?", latestTicket.ID).Updates(map[string]any{
				"status":        "waiting_user",
				"last_reply_at": now,
			}).Error
		}

		response := gin.H{
			"id":        msg.ID,
			"chatId":    msg.ChatID,
			"senderId":  "support",
			"sender":    supportSenderDisplay,
			"text":      msg.Text,
			"createdAt": msg.CreatedAt,
		}

		messageJSON, _ := json.Marshal(gin.H{"type": "message", "message": response})
		wsHub.BroadcastToChat(chat.ID, messageJSON)
		c.JSON(http.StatusOK, response)
	}
}
