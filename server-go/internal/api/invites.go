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

// GenerateInviteLink creates or rotates an invite link for a group or channel and can optionally email it.
func GenerateInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
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

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient_permissions"})
			return
		}

		bytes := make([]byte, 16)
		_, _ = rand.Read(bytes)
		inviteLink := base64.URLEncoding.EncodeToString(bytes)

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

		response := gin.H{
			"inviteLink": inviteLink,
			"url":        "/app/join/" + inviteLink,
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
			groupName := strings.TrimSpace(chat.Name)
			if groupName == "" {
				if chat.Type == "channel" {
					groupName = "SafeGram Channel"
				} else {
					groupName = "SafeGram Group"
				}
			}
			queueEmailJob("group_invite", map[string]interface{}{
				"chatId": chat.ID,
				"email":  maskEmail(to),
			}, func() error {
				return email.SendGroupInvite(to, recipientUsername, inviterName, groupName, chatInviteURL(inviteLink))
			})
			response["emailQueued"] = true
		}

		c.JSON(http.StatusOK, response)
	}
}

// JoinByInviteLink joins a group/channel by invite link.
func JoinByInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		inviteLink := c.Param("link")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var chat models.Chat
		if err := db.Where("invite_link = ? AND type IN (?, ?)", inviteLink, "group", "channel").First(&chat).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "invalid_link"})
			return
		}

		var existingMember models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chat.ID, userIDStr).First(&existingMember).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{
				"chat":    chat,
				"message": "already_member",
			})
			return
		}

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
			"chat":    chat,
			"message": "joined",
		})
	}
}
