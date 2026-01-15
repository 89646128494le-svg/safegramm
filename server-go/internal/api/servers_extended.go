package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetServerMembers возвращает участников сервера
func GetServerMembers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем доступ
		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var members []models.ServerMember
		db.Where("server_id = ?", serverID).Preload("User").Find(&members)

		result := make([]gin.H, len(members))
		for i, m := range members {
			result[i] = gin.H{
				"id":       m.ID,
				"userId":   m.UserID,
				"role":     m.Role,
				"joinedAt": m.JoinedAt,
				"user": gin.H{
					"id":       m.User.ID,
					"username": m.User.Username,
					"avatarUrl": m.User.AvatarURL,
					"status":   m.User.Status,
				},
			}
		}

		c.JSON(http.StatusOK, gin.H{"members": result})
	}
}

// JoinServer присоединяет пользователя к серверу
func JoinServer(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, не является ли уже участником
		var existing models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "already_member"})
			return
		}

		member := models.ServerMember{
			ID:       uuid.New().String(),
			ServerID: serverID,
			UserID:   userIDStr,
			Role:     "member",
		}
		db.Create(&member)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// LeaveServer покидает сервер
func LeaveServer(db *gorm.DB) gin.HandlerFunc {
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
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Нельзя покинуть сервер, если ты owner
		if member.Role == "owner" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "owner_cannot_leave"})
			return
		}

		db.Delete(&member)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// CreateChannel создает канал в сервере
func CreateChannel(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права (owner или admin)
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
			Name     string `json:"name" binding:"required"`
			Type     string `json:"type"`
			Position int    `json:"position"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if req.Type == "" {
			req.Type = "text"
		}

		channel := models.Channel{
			ID:       uuid.New().String(),
			ServerID: serverID,
			Name:     req.Name,
			Type:     req.Type,
			Position: req.Position,
		}

		if err := db.Create(&channel).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"channel": channel})
	}
}

// GetChannels возвращает каналы сервера
func GetChannels(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем доступ
		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var channels []models.Channel
		db.Where("server_id = ?", serverID).Order("position ASC").Find(&channels)

		c.JSON(http.StatusOK, gin.H{"channels": channels})
	}
}

// DeleteChannel удаляет канал
func DeleteChannel(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		channelID := c.Param("channelId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права
		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		db.Delete(&models.Channel{}, "id = ? AND server_id = ?", channelID, serverID)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

