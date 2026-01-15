package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CreateVoiceRoom создает голосовую комнату
func CreateVoiceRoom(db *gorm.DB) gin.HandlerFunc {
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

		// Проверяем, нет ли уже активной комнаты
		var existing models.VoiceRoom
		if err := db.Where("chat_id = ? AND is_active = ?", chatID, true).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room_exists"})
			return
		}

		room := models.VoiceRoom{
			ID:        uuid.New().String(),
			ChatID:    chatID,
			CreatedBy: userIDStr,
			IsActive:  true,
		}

		if err := db.Create(&room).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"room": room})
	}
}

// GetVoiceRoom возвращает активную голосовую комнату чата
func GetVoiceRoom(db *gorm.DB) gin.HandlerFunc {
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

		var room models.VoiceRoom
		if err := db.Where("chat_id = ? AND is_active = ?", chatID, true).First(&room).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"room": room})
	}
}

// EndVoiceRoom завершает голосовую комнату
func EndVoiceRoom(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("roomId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var room models.VoiceRoom
		if err := db.First(&room, "id = ?", roomID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Только создатель может завершить комнату
		if room.CreatedBy != userIDStr {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		db.Model(&room).Update("is_active", false)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

