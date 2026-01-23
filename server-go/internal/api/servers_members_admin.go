package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// BulkAddServerMembers массовое добавление участников в сервер (owner/admin)
func BulkAddServerMembers(db *gorm.DB) gin.HandlerFunc {
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

		var req struct {
			UserIDs []string `json:"userIds" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || len(req.UserIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Каналы сервера (чаты)
		var channels []models.Channel
		db.Where("server_id = ?", serverID).Find(&channels)

		added := 0
		for _, uid := range req.UserIDs {
			if uid == "" {
				continue
			}
			var existing models.ServerMember
			if err := db.Where("server_id = ? AND user_id = ?", serverID, uid).First(&existing).Error; err == nil {
				continue
			}
			sm := models.ServerMember{
				ID:       uuid.New().String(),
				ServerID: serverID,
				UserID:   uid,
				Role:     "member",
			}
			if err := db.Create(&sm).Error; err == nil {
				added++
				logMemberEvent(db, "server", serverID, uid, userIDStr, "add", gin.H{"bulk": true})
				// добавляем в chat_members всех каналов
				for _, ch := range channels {
					if ch.ChatID == "" {
						continue
					}
					db.Create(&models.ChatMember{
						ID:     uuid.New().String(),
						ChatID: ch.ChatID,
						UserID: uid,
						Role:   "member",
					})
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "added": added})
	}
}

// SetServerMemberRole меняет роль участника сервера (owner/admin)
func SetServerMemberRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		targetUserID := c.Param("userId")
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

		var req struct {
			Role string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		allowed := map[string]bool{"owner": true, "admin": true, "moderator": true, "member": true}
		if !allowed[req.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var target models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, targetUserID).First(&target).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if target.Role == "owner" && member.Role != "owner" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		prev := target.Role
		target.Role = req.Role
		db.Save(&target)
		logMemberEvent(db, "server", serverID, targetUserID, userIDStr, "role_change", gin.H{"from": prev, "to": req.Role})

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

