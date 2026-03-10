package api

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
)

// GenerateServerInviteLink creates or rotates an invite link for a server and can optionally email it.
func GenerateServerInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Email           string `json:"email"`
			RecipientUserID string `json:"recipientUserId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
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

		var server models.Server
		if err := db.First(&server, "id = ?", serverID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if err := db.Model(&models.Server{}).Where("id = ?", serverID).Update("invite_link", invite).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		logModeration(db, "", serverID, userIDStr, "server_invite_link_rotate", "", "", nil)

		response := gin.H{
			"inviteLink": invite,
			"url":        "/app/servers/join/" + invite,
		}

		to, recipientUsername, err := resolveInviteRecipient(db, req.RecipientUserID, req.Email)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invite_email_unavailable"})
			return
		}
		if to != "" {
			inviterName := strings.TrimSpace(userIDStr)
			var inviter models.User
			if err := db.Select("id", "username").First(&inviter, "id = ?", userIDStr).Error; err == nil && strings.TrimSpace(inviter.Username) != "" {
				inviterName = inviter.Username
			}
			serverName := strings.TrimSpace(server.Name)
			if serverName == "" {
				serverName = "SafeGram Server"
			}
			queueEmailJob("server_invite", map[string]interface{}{
				"serverId": server.ID,
				"email":    maskEmail(to),
			}, func() error {
				return email.SendGroupInvite(to, recipientUsername, inviterName, serverName, serverInviteURL(invite))
			})
			response["emailQueued"] = true
		}

		c.JSON(http.StatusOK, response)
	}
}

// JoinByServerInviteLink joins a server by invite link.
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

		var existing models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", server.ID, userIDStr).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"server": server, "message": "already_member"})
			return
		}

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

		var channels []models.Channel
		db.Where("server_id = ?", server.ID).Find(&channels)
		for _, channel := range channels {
			if channel.ChatID == "" {
				continue
			}
			db.Create(&models.ChatMember{
				ID:     uuid.New().String(),
				ChatID: channel.ChatID,
				UserID: userIDStr,
				Role:   "member",
			})
		}

		logMemberEvent(db, "server", server.ID, userIDStr, userIDStr, "join", gin.H{"via": "invite_link"})
		c.JSON(http.StatusOK, gin.H{"server": server, "message": "joined"})
	}
}
