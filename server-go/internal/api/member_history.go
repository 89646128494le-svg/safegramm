package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetGroupMemberHistory история участников группы (chat type=group)
func GetGroupMemberHistory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Доступ только участникам
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var events []models.MemberEvent
		db.Where("scope_type = ? AND scope_id = ?", "chat", groupID).
			Order("created_at DESC").
			Limit(200).
			Find(&events)

		c.JSON(http.StatusOK, gin.H{"events": events})
	}
}

// GetServerMemberHistory история участников сервера
func GetServerMemberHistory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Доступ только участникам
		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var events []models.MemberEvent
		db.Where("scope_type = ? AND scope_id = ?", "server", serverID).
			Order("created_at DESC").
			Limit(200).
			Find(&events)

		c.JSON(http.StatusOK, gin.H{"events": events})
	}
}

