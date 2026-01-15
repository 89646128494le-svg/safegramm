package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// SaveMessage сохраняет сообщение в избранное
func SaveMessage(db *gorm.DB) gin.HandlerFunc {
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

		// Проверяем, не сохранено ли уже
		var existing models.SavedMessage
		if err := db.Where("user_id = ? AND message_id = ?", userIDStr, messageID).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"ok": true, "id": existing.ID, "alreadySaved": true})
			return
		}

		// Создаем сохраненное сообщение
		saved := models.SavedMessage{
			ID:        uuid.New().String(),
			UserID:    userIDStr,
			MessageID: messageID,
		}

		if err := db.Create(&saved).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "id": saved.ID})
	}
}

// UnsaveMessage удаляет сообщение из избранного
func UnsaveMessage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Удаляем сохраненное сообщение
		if err := db.Where("user_id = ? AND message_id = ?", userIDStr, messageID).Delete(&models.SavedMessage{}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetSavedMessages возвращает список сохраненных сообщений пользователя
func GetSavedMessages(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var savedMessages []models.SavedMessage
		if err := db.Where("user_id = ?", userIDStr).
			Preload("Message").
			Preload("Message.Sender").
			Preload("Message.Chat").
			Order("created_at DESC").
			Find(&savedMessages).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(savedMessages))
		for i, saved := range savedMessages {
			msgData := gin.H{
				"id":        saved.ID,
				"messageId": saved.MessageID,
				"savedAt":   saved.CreatedAt.Unix() * 1000,
			}

			if saved.Message.ID != "" {
				msgData["message"] = gin.H{
					"id":            saved.Message.ID,
					"chatId":        saved.Message.ChatID,
					"senderId":      saved.Message.SenderID,
					"text":          saved.Message.Text,
					"attachmentUrl": saved.Message.AttachmentURL,
					"createdAt":     saved.Message.CreatedAt.Unix() * 1000,
				}

				if saved.Message.Sender.ID != "" {
					msgData["sender"] = gin.H{
						"id":       saved.Message.Sender.ID,
						"username": saved.Message.Sender.Username,
						"avatarUrl": saved.Message.Sender.AvatarURL,
					}
				}

				if saved.Message.Chat.ID != "" {
					msgData["chat"] = gin.H{
						"id":   saved.Message.Chat.ID,
						"type": saved.Message.Chat.Type,
						"name": saved.Message.Chat.Name,
					}
				}
			}

			result[i] = msgData
		}

		c.JSON(http.StatusOK, gin.H{"savedMessages": result})
	}
}

