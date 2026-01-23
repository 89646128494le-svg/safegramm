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

// GenerateServerInviteLink создает/обновляет invite-link сервера (owner/admin)
func GenerateServerInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		b := make([]byte, 16)
		_, _ = rand.Read(b)
		invite := base64.URLEncoding.EncodeToString(b)

		if err := db.Model(&models.Server{}).Where("id = ?", serverID).Update("invite_link", invite).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		logModeration(db, "", serverID, userIDStr, "server_invite_link_rotate", "", "", nil)

		c.JSON(http.StatusOK, gin.H{
			"inviteLink": invite,
			"url":        "/app/servers/join/" + invite,
		})
	}
}

// JoinByServerInviteLink присоединение к серверу по invite-link
func JoinByServerInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		link := c.Param("link")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var server models.Server
		if err := db.Where("invite_link = ?", link).First(&server).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "invalid_link"})
			return
		}

		// если уже участник
		var existing models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", server.ID, userIDStr).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"server": server, "message": "already_member"})
			return
		}

		// создаем membership
		member := models.ServerMember{
			ID:       uuid.New().String(),
			ServerID: server.ID,
			UserID:   userIDStr,
			Role:     "member",
		}
		if err := db.Create(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// добавляем в чаты каналов
		var channels []models.Channel
		db.Where("server_id = ?", server.ID).Find(&channels)
		for _, ch := range channels {
			if ch.ChatID == "" {
				continue
			}
			db.Create(&models.ChatMember{
				ID:     uuid.New().String(),
				ChatID: ch.ChatID,
				UserID: userIDStr,
				Role:   "member",
			})
		}

		logMemberEvent(db, "server", server.ID, userIDStr, userIDStr, "join", gin.H{"via": "invite_link"})

		c.JSON(http.StatusOK, gin.H{"server": server, "message": "joined"})
	}
}

