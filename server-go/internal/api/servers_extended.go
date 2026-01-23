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

		// Добавляем пользователя во все чаты каналов сервера
		var channels []models.Channel
		db.Where("server_id = ?", serverID).Find(&channels)
		for _, ch := range channels {
			if ch.ChatID == "" {
				continue
			}
			// пропускаем если уже есть
			var cm models.ChatMember
			if err := db.Where("chat_id = ? AND user_id = ?", ch.ChatID, userIDStr).First(&cm).Error; err == nil {
				continue
			}
			db.Create(&models.ChatMember{
				ID:     uuid.New().String(),
				ChatID: ch.ChatID,
				UserID: userIDStr,
				Role:   "member",
			})
		}

		logMemberEvent(db, "server", serverID, userIDStr, userIDStr, "join", nil)

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
		logMemberEvent(db, "server", serverID, userIDStr, userIDStr, "leave", nil)
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

		// Создаем чат для сообщений канала
		channelChat := models.Chat{
			ID:        uuid.New().String(),
			Type:      "channel",
			Name:      req.Name,
			CreatedBy: userIDStr,
		}
		if err := db.Create(&channelChat).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		channel.ChatID = channelChat.ID

		if err := db.Create(&channel).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Добавляем всех участников сервера в чат канала
		var members []models.ServerMember
		db.Where("server_id = ?", serverID).Find(&members)
		for _, m := range members {
			role := "member"
			if m.Role == "owner" || m.Role == "admin" {
				role = m.Role
			}
			db.Create(&models.ChatMember{
				ID:     uuid.New().String(),
				ChatID: channelChat.ID,
				UserID: m.UserID,
				Role:   role,
			})
		}

		logModeration(db, "", serverID, userIDStr, "channel_create", "", "", gin.H{"channelId": channel.ID, "name": channel.Name})

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

		var channel models.Channel
		_ = db.First(&channel, "id = ? AND server_id = ?", channelID, serverID).Error
		db.Delete(&models.Channel{}, "id = ? AND server_id = ?", channelID, serverID)
		if channel.ChatID != "" {
			db.Delete(&models.ChatMember{}, "chat_id = ?", channel.ChatID)
			db.Delete(&models.Chat{}, "id = ?", channel.ChatID)
		}
		logModeration(db, "", serverID, userIDStr, "channel_delete", "", "", gin.H{"channelId": channelID})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

