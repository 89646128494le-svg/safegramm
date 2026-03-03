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

// CreateServer создает новый сервер
func CreateServer(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Name        string `json:"name" binding:"required,min=2"`
			Description string `json:"description"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		server := models.Server{
			ID:          uuid.New().String(),
			Name:        req.Name,
			Description: req.Description,
			OwnerID:     userIDStr,
		}

		if err := db.Create(&server).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Добавляем владельца как участника
		member := models.ServerMember{
			ID:       uuid.New().String(),
			ServerID: server.ID,
			UserID:   userIDStr,
			Role:     "owner",
		}
		db.Create(&member)
		logMemberEvent(db, "server", server.ID, userIDStr, userIDStr, "create", gin.H{"name": server.Name})

		// Генерируем invite link для сервера
		b := make([]byte, 16)
		_, _ = rand.Read(b)
		server.InviteLink = base64.URLEncoding.EncodeToString(b)
		db.Model(&models.Server{}).Where("id = ?", server.ID).Update("invite_link", server.InviteLink)

		// Создаем чат для канала по умолчанию (уникальный InviteLink)
		channelChat := models.Chat{
			ID:         uuid.New().String(),
			Type:      "channel",
			Name:      "general",
			CreatedBy: userIDStr,
			InviteLink: "ch:" + uuid.New().String(),
		}
		db.Create(&channelChat)

		// Создаем канал по умолчанию и привязываем к чату
		channel := models.Channel{
			ID:       uuid.New().String(),
			ServerID: server.ID,
			ChatID:   channelChat.ID,
			Name:     "general",
			Type:     "text",
			Position: 0,
		}
		db.Create(&channel)

		// Добавляем владельца в чат канала
		db.Create(&models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: channelChat.ID,
			UserID: userIDStr,
			Role:   "owner",
		})

		c.JSON(http.StatusOK, gin.H{"server": server})
	}
}

// UpdateServer обновляет настройки сервера (owner/admin)
func UpdateServer(db *gorm.DB) gin.HandlerFunc {
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

		var server models.Server
		if err := db.First(&server, "id = ?", serverID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		var req struct {
			Name        *string `json:"name"`
			Description *string `json:"description"`
			IconURL     *string `json:"iconUrl"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if req.Name != nil && len(*req.Name) >= 2 {
			server.Name = *req.Name
		}
		if req.Description != nil {
			server.Description = *req.Description
		}
		if req.IconURL != nil {
			server.IconURL = *req.IconURL
		}
		if err := db.Save(&server).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"server": server})
	}
}

// GetServers возвращает серверы пользователя
func GetServers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var members []models.ServerMember
		db.Where("user_id = ?", userIDStr).Find(&members)

		serverIDs := make([]string, len(members))
		for i, m := range members {
			serverIDs[i] = m.ServerID
		}

		var servers []models.Server
		db.Where("id IN ?", serverIDs).Find(&servers)

		c.JSON(http.StatusOK, gin.H{"servers": servers})
	}
}

// GetServer возвращает информацию о сервере
func GetServer(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var server models.Server
		if err := db.First(&server, "id = ?", serverID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем доступ
		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"server": server})
	}
}

