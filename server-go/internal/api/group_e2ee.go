package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetGroupKey получает зашифрованный групповой ключ для текущего пользователя
func GetGroupKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, является ли пользователь участником
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Проверяем, что это группа или канал
		var chat models.Chat
		if err := db.First(&chat, "id = ?", chatID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		if chat.Type != "group" && chat.Type != "channel" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "not_a_group"})
			return
		}

		// Получаем последнюю версию ключа для пользователя
		var groupKey models.GroupKey
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).
			Order("key_version DESC").
			First(&groupKey).Error; err != nil {
			// Ключа нет - нужно создать
			c.JSON(http.StatusNotFound, gin.H{"error": "key_not_found", "message": "Group key not initialized"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"wrappedKey": groupKey.WrappedKey,
			"keyVersion":  groupKey.KeyVersion,
			"createdBy":  groupKey.CreatedBy,
		})
	}
}

// InitializeGroupKey инициализирует групповой ключ (только для owner/admin)
func InitializeGroupKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права (только owner/admin)
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient_permissions"})
			return
		}

		// Проверяем, что это группа или канал
		var chat models.Chat
		if err := db.Preload("Members").First(&chat, "id = ?", chatID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		if chat.Type != "group" && chat.Type != "channel" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "not_a_group"})
			return
		}

		var req struct {
			WrappedKeys map[string]string `json:"wrappedKeys" binding:"required"` // userId -> wrappedKey
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Сохраняем ключи для всех участников
		keyVersion := 1
		var existingKey models.GroupKey
		if err := db.Where("chat_id = ?", chatID).Order("key_version DESC").First(&existingKey).Error; err == nil {
			keyVersion = existingKey.KeyVersion + 1
		}

		for userID, wrappedKey := range req.WrappedKeys {
			// Проверяем, что пользователь является участником
			var isMember bool
			for _, m := range chat.Members {
				if m.UserID == userID {
					isMember = true
					break
				}
			}
			if !isMember {
				continue // Пропускаем не-участников
			}

			groupKey := models.GroupKey{
				ID:         uuid.New().String(),
				ChatID:     chatID,
				UserID:     userID,
				WrappedKey: wrappedKey,
				KeyVersion: keyVersion,
				CreatedBy:  userIDStr,
			}
			db.Create(&groupKey)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":    "Group key initialized",
			"keyVersion": keyVersion,
		})
	}
}

// UpdateGroupKey обновляет групповой ключ (при добавлении/удалении участников)
func UpdateGroupKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права (только owner/admin)
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient_permissions"})
			return
		}

		var chat models.Chat
		if err := db.Preload("Members").First(&chat, "id = ?", chatID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		var req struct {
			WrappedKeys map[string]string `json:"wrappedKeys" binding:"required"` // userId -> wrappedKey
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Получаем следующую версию ключа
		var lastKey models.GroupKey
		keyVersion := 1
		if err := db.Where("chat_id = ?", chatID).Order("key_version DESC").First(&lastKey).Error; err == nil {
			keyVersion = lastKey.KeyVersion + 1
		}

		// Удаляем старые ключи (soft delete)
		db.Where("chat_id = ?", chatID).Delete(&models.GroupKey{})

		// Создаём новые ключи для всех текущих участников
		for userID, wrappedKey := range req.WrappedKeys {
			// Проверяем, что пользователь является участником
			var isMember bool
			for _, m := range chat.Members {
				if m.UserID == userID {
					isMember = true
					break
				}
			}
			if !isMember {
				continue
			}

			groupKey := models.GroupKey{
				ID:         uuid.New().String(),
				ChatID:     chatID,
				UserID:     userID,
				WrappedKey: wrappedKey,
				KeyVersion: keyVersion,
				CreatedBy:  userIDStr,
			}
			db.Create(&groupKey)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":    "Group key updated",
			"keyVersion": keyVersion,
		})
	}
}

// GetGroupKeyVersion получает текущую версию ключа группы
func GetGroupKeyVersion(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, является ли пользователь участником
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var lastKey models.GroupKey
		keyVersion := 0
		if err := db.Where("chat_id = ?", chatID).Order("key_version DESC").First(&lastKey).Error; err == nil {
			keyVersion = lastKey.KeyVersion
		}

		c.JSON(http.StatusOK, gin.H{
			"keyVersion": keyVersion,
		})
	}
}
