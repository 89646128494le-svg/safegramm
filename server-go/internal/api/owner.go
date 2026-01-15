package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// RequireOwner проверяет, что пользователь является владельцем платформы
func RequireOwner(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			c.Abort()
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			c.Abort()
			return
		}

		roles := user.ParseRoles()
		isOwner := false
		for _, role := range roles {
			if role == "owner" {
				isOwner = true
				break
			}
		}

		if !isOwner {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "detail": "owner_only"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetOwnerDashboard возвращает статистику для панели владельца
func GetOwnerDashboard(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var stats gin.H

		// Статистика пользователей
		var totalUsers int64
		var premiumUsers int64
		var activeUsers int64
		db.Model(&models.User{}).Count(&totalUsers)
		db.Model(&models.User{}).Where("plan = ?", "premium").Count(&premiumUsers)
		db.Model(&models.User{}).Where("last_seen > ?", time.Now().Add(-7*24*time.Hour)).Count(&activeUsers)

		// Статистика чатов
		var totalChats int64
		var groupChats int64
		var channelChats int64
		db.Model(&models.Chat{}).Count(&totalChats)
		db.Model(&models.Chat{}).Where("type = ?", "group").Count(&groupChats)
		db.Model(&models.Chat{}).Where("type = ?", "channel").Count(&channelChats)

		// Статистика сообщений
		var totalMessages int64
		var messagesLast24h int64
		db.Model(&models.Message{}).Count(&totalMessages)
		db.Model(&models.Message{}).Where("created_at > ?", time.Now().Add(-24*time.Hour)).Count(&messagesLast24h)

		// Статистика серверов
		var totalServers int64
		db.Model(&models.Server{}).Count(&totalServers)

		// Последние регистрации
		var recentUsers []models.User
		db.Order("created_at DESC").Limit(10).Find(&recentUsers)
		recentUsersData := make([]gin.H, len(recentUsers))
		for i, u := range recentUsers {
			recentUsersData[i] = gin.H{
				"id":       u.ID,
				"username": u.Username,
				"email":    func() string { if u.Email != nil { return *u.Email }; return "" }(),
				"plan":     u.Plan,
				"createdAt": u.CreatedAt.Unix() * 1000,
			}
		}

		stats = gin.H{
			"users": gin.H{
				"total":   totalUsers,
				"premium": premiumUsers,
				"active":  activeUsers,
				"recent":  recentUsersData,
			},
			"chats": gin.H{
				"total":   totalChats,
				"groups":  groupChats,
				"channels": channelChats,
			},
			"messages": gin.H{
				"total":      totalMessages,
				"last24h":    messagesLast24h,
			},
			"servers": gin.H{
				"total": totalServers,
			},
			"timestamp": time.Now().Unix() * 1000,
		}

		c.JSON(http.StatusOK, stats)
	}
}

// SetUserPlan устанавливает план пользователя (free/premium)
func SetUserPlan(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var req struct {
			Plan string `json:"plan" binding:"required"` // free, premium
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if req.Plan != "free" && req.Plan != "premium" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_plan"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		user.Plan = req.Plan
		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "plan": user.Plan})
	}
}

// SetUserRole устанавливает роль пользователя
func SetUserRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var req struct {
			Roles []string `json:"roles" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что не удаляем роль owner у владельца
		currentRoles := user.ParseRoles()
		hasOwner := false
		for _, r := range currentRoles {
			if r == "owner" {
				hasOwner = true
				break
			}
		}

		willHaveOwner := false
		for _, r := range req.Roles {
			if r == "owner" {
				willHaveOwner = true
				break
			}
		}

		if hasOwner && !willHaveOwner {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot_remove_owner_role"})
			return
		}

		rolesJSON, _ := json.Marshal(req.Roles)
		user.Roles = string(rolesJSON)
		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "roles": req.Roles})
	}
}

// DeleteUser удаляет пользователя (только для владельца)
func DeleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")

		// Нельзя удалить себя
		if userID == currentUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_delete_self"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Нельзя удалить владельца
		roles := user.ParseRoles()
		for _, role := range roles {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_delete_owner"})
				return
			}
		}

		// Мягкое удаление
		if err := db.Delete(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetSystemSettings возвращает системные настройки
func GetSystemSettings(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// В будущем можно хранить в отдельной таблице
		settings := gin.H{
			"maintenance": false,
			"registrationEnabled": true,
			"maxFileSize": 100 * 1024 * 1024, // 100MB
			"maxChatMembers": 200000,
			"premiumPrice": 299, // рублей в месяц
			"premiumFeatures": []string{
				"Увеличенный лимит загрузки файлов",
				"Приоритетная поддержка",
				"Расширенные настройки приватности",
				"Неограниченное количество чатов",
				"Экспорт истории",
			},
		}

		c.JSON(http.StatusOK, settings)
	}
}

// UpdateSystemSettings обновляет системные настройки
func UpdateSystemSettings(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Maintenance         *bool `json:"maintenance"`
			RegistrationEnabled *bool `json:"registrationEnabled"`
			MaxFileSize         *int64 `json:"maxFileSize"`
			MaxChatMembers      *int `json:"maxChatMembers"`
			PremiumPrice        *int `json:"premiumPrice"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// В будущем сохранять в БД
		// Пока просто возвращаем успех
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

