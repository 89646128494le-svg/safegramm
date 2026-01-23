package api

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GenerateInviteLink генерирует ссылку для приглашения в группу/канал
func GenerateInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права (только owner/admin могут создавать ссылки)
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient_permissions"})
			return
		}

		// Генерируем уникальную ссылку
		bytes := make([]byte, 16)
		rand.Read(bytes)
		inviteLink := base64.URLEncoding.EncodeToString(bytes)

		// Сохраняем ссылку в чат
		var chat models.Chat
		if err := db.First(&chat, "id = ?", chatID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		chat.InviteLink = inviteLink
		if err := db.Save(&chat).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"inviteLink": inviteLink,
			"url":        "/app/join/" + inviteLink,
		})
	}
}

// JoinByInviteLink присоединение к чату по ссылке
func JoinByInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		inviteLink := c.Param("link")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Находим чат по ссылке
		var chat models.Chat
		if err := db.Where("invite_link = ? AND type IN (?, ?)", inviteLink, "group", "channel").First(&chat).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "invalid_link"})
			return
		}

		// Проверяем, не является ли пользователь уже участником
		var existingMember models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chat.ID, userIDStr).First(&existingMember).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{
				"chat": chat,
				"message": "Вы уже участник этого чата",
			})
			return
		}

		// Добавляем пользователя как участника
		member := models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: chat.ID,
			UserID: userIDStr,
			Role:   "member",
		}

		if err := db.Create(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"chat": chat,
			"message": "Вы успешно присоединились к чату",
		})
	}
}
