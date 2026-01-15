package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CreateThread создает новый тред
func CreateThread(db *gorm.DB) gin.HandlerFunc {
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

		var req struct {
			RootMessageID string `json:"rootMessageId" binding:"required"`
			Name          string `json:"name"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		thread := models.Thread{
			ID:           uuid.New().String(),
			ChatID:       chatID,
			RootMessageID: req.RootMessageID,
			Name:         req.Name,
		}

		if err := db.Create(&thread).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"thread": thread})
	}
}

// GetThreads возвращает треды чата
func GetThreads(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем доступ
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var threads []models.Thread
		if err := db.Where("chat_id = ?", chatID).Find(&threads).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Добавляем статистику
		result := make([]gin.H, len(threads))
		for i, thread := range threads {
			var count int64
			db.Model(&models.Message{}).Where("thread_id = ?", thread.ID).Count(&count)
			
			var lastMessage models.Message
			db.Where("thread_id = ?", thread.ID).Order("created_at DESC").First(&lastMessage)

			result[i] = gin.H{
				"id":           thread.ID,
				"chatId":       thread.ChatID,
				"rootMessageId": thread.RootMessageID,
				"name":         thread.Name,
				"createdAt":    thread.CreatedAt,
				"messageCount": count,
				"lastMessage":  lastMessage,
			}
		}

		c.JSON(http.StatusOK, gin.H{"threads": result})
	}
}

// GetThreadMessages возвращает сообщения треда
func GetThreadMessages(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		threadID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var thread models.Thread
		if err := db.First(&thread, "id = ?", threadID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", thread.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var messages []models.Message
		if err := db.Where("thread_id = ? AND deleted_at IS NULL", threadID).
			Preload("Sender").
			Preload("Reactions").
			Preload("Reactions.User").
			Order("created_at ASC").
			Limit(100).
			Find(&messages).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"messages": messages})
	}
}

