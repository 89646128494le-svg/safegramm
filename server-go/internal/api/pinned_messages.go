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

// PinMessage закрепляет сообщение в чате
func PinMessage(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем существование сообщения
		var message models.Message
		if err := db.First(&message, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", message.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Проверяем права (только админы и владельцы могут закреплять)
		if member.Role != "owner" && member.Role != "admin" {
			// Для DM чатов разрешаем закреплять всем
			var chat models.Chat
			if err := db.First(&chat, "id = ?", message.ChatID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
				return
			}
			if chat.Type != "dm" {
				c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "detail": "only_admins_can_pin"})
				return
			}
		}

		// Проверяем, не закреплено ли уже
		var existing models.PinnedMessage
		if err := db.Where("message_id = ?", messageID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "already_pinned"})
			return
		}

		// Проверяем лимит закрепленных сообщений (максимум 5)
		var pinnedCount int64
		db.Model(&models.PinnedMessage{}).Where("chat_id = ?", message.ChatID).Count(&pinnedCount)
		if pinnedCount >= 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "pin_limit_reached", "detail": "max_5_pinned"})
			return
		}

		// Создаем запись о закреплении
		pinned := models.PinnedMessage{
			ID:        uuid.New().String(),
			ChatID:    message.ChatID,
			MessageID: messageID,
			PinnedBy:  userIDStr,
		}

		if err := db.Create(&pinned).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем полную информацию
		db.Preload("Message").Preload("Message.Sender").Preload("User").First(&pinned, "id = ?", pinned.ID)

		// Отправляем уведомление через WebSocket
		pinJSON, _ := json.Marshal(gin.H{
			"type": "message:pinned",
			"data": gin.H{
				"messageId": messageID,
				"chatId":    message.ChatID,
				"pinnedBy":  userIDStr,
				"pinnedAt":  pinned.PinnedAt,
			},
		})
		wsHub.BroadcastToChat(message.ChatID, pinJSON)

		c.JSON(http.StatusOK, pinned)
	}
}

// UnpinMessage открепляет сообщение
func UnpinMessage(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем существование закрепления
		var pinned models.PinnedMessage
		if err := db.First(&pinned, "message_id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", pinned.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Проверяем права (только админы, владельцы или тот, кто закрепил)
		if member.Role != "owner" && member.Role != "admin" && pinned.PinnedBy != userIDStr {
			var chat models.Chat
			if err := db.First(&chat, "id = ?", pinned.ChatID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
				return
			}
			if chat.Type != "dm" {
				c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
				return
			}
		}

		// Удаляем закрепление
		if err := db.Delete(&pinned).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Отправляем уведомление через WebSocket
		unpinJSON, _ := json.Marshal(gin.H{
			"type": "message:unpinned",
			"data": gin.H{
				"messageId": messageID,
				"chatId":    pinned.ChatID,
				"unpinnedBy": userIDStr,
			},
		})
		wsHub.BroadcastToChat(pinned.ChatID, unpinJSON)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetPinnedMessages получает список закрепленных сообщений в чате
func GetPinnedMessages(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Получаем закрепленные сообщения
		var pinned []models.PinnedMessage
		if err := db.Where("chat_id = ?", chatID).
			Preload("Message").
			Preload("Message.Sender").
			Preload("User").
			Order("pinned_at DESC").
			Find(&pinned).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Формируем ответ
		result := make([]gin.H, len(pinned))
		for i, p := range pinned {
			msgData := gin.H{
				"id":            p.Message.ID,
				"chatId":        p.Message.ChatID,
				"senderId":      p.Message.SenderID,
				"text":          p.Message.Text,
				"attachmentUrl": p.Message.AttachmentURL,
				"createdAt":     p.Message.CreatedAt,
			}
			if p.Message.Sender.ID != "" {
				msgData["sender"] = gin.H{
					"id":       p.Message.Sender.ID,
					"username": p.Message.Sender.Username,
					"avatarUrl": p.Message.Sender.AvatarURL,
				}
			}

			result[i] = gin.H{
				"id":        p.ID,
				"chatId":    p.ChatID,
				"messageId": p.MessageID,
				"pinnedBy":  p.PinnedBy,
				"pinnedAt":  p.PinnedAt,
				"message":   msgData,
				"user": gin.H{
					"id":       p.User.ID,
					"username": p.User.Username,
					"avatarUrl": p.User.AvatarURL,
				},
			}
		}

		c.JSON(http.StatusOK, gin.H{"pinned": result})
	}
}


