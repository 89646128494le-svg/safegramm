package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/redis"
)

// getOnlineCount возвращает количество онлайн пользователей из Redis
func getOnlineCount() int {
	onlineUsers, err := redis.GetOnlineUsers()
	if err != nil {
		return 0
	}
	return len(onlineUsers)
}

// RequireAdmin проверяет, что пользователь является админом
func RequireAdmin(db *gorm.DB) gin.HandlerFunc {
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
		isAdmin := false
		for _, role := range roles {
			if role == "admin" || role == "owner" {
				isAdmin = true
				break
			}
		}

		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetAdminUsers возвращает список всех пользователей (для админов)
func GetAdminUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User
		if err := db.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(users))
		for i, user := range users {
			result[i] = gin.H{
				"id":        user.ID,
				"username":  user.Username,
				"email":     func() string { if user.Email != nil { return *user.Email }; return "" }(),
				"roles":     user.ParseRoles(),
				"plan":      user.Plan,
				"status":    user.Status,
				"avatarUrl": user.AvatarURL,
				"createdAt": user.CreatedAt,
				"lastSeen":  user.LastSeen,
			}
		}

		c.JSON(http.StatusOK, gin.H{"users": result})
	}
}

// BlockUser блокирует пользователя
func BlockUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")

		// Нельзя заблокировать себя
		if userID == currentUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_block_self"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что это не owner
		roles := user.ParseRoles()
		for _, role := range roles {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_block_owner"})
				return
			}
		}

		// Убираем админ права и блокируем
		db.Model(&user).Updates(map[string]interface{}{
			"status": "banned",
			"roles":  "[]",
		})

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// UnblockUser разблокирует пользователя
func UnblockUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		db.Model(&user).Update("status", "online")
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// PromoteUser назначает пользователя админом
func PromoteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		roles := user.ParseRoles()
		hasAdmin := false
		for _, role := range roles {
			if role == "admin" {
				hasAdmin = true
				break
			}
		}

		if !hasAdmin {
			roles = append(roles, "admin")
			user.SetRoles(roles)
			db.Model(&user).Update("roles", user.Roles)
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "roles": roles})
	}
}

// DemoteUser снимает админ права
func DemoteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")

		// Нельзя снять права у себя
		if userID == currentUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_demote_self"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что это не owner
		roles := user.ParseRoles()
		for _, role := range roles {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_demote_owner"})
				return
			}
		}

		// Убираем admin из ролей
		newRoles := []string{}
		for _, role := range roles {
			if role != "admin" {
				newRoles = append(newRoles, role)
			}
		}
		user.SetRoles(newRoles)
		db.Model(&user).Update("roles", user.Roles)

		c.JSON(http.StatusOK, gin.H{"ok": true, "roles": newRoles})
	}
}

// GetAdminStats возвращает статистику для админов
func GetAdminStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userCount, chatCount, messageCount int64

		db.Model(&models.User{}).Count(&userCount)
		db.Model(&models.Chat{}).Count(&chatCount)
		db.Model(&models.Message{}).Count(&messageCount)

		var serverCount int64
		db.Model(&models.Server{}).Count(&serverCount)

		c.JSON(http.StatusOK, gin.H{
			"stats": gin.H{
				"users":    userCount,
				"chats":    chatCount,
				"messages": messageCount,
				"servers":  serverCount,
				"online":   getOnlineCount(), // Из Redis
			},
		})
	}
}

// GetAdminFeedback возвращает список обратной связи от пользователей
func GetAdminFeedback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: В будущем можно добавить модель Feedback
		// Пока возвращаем пустой массив
		c.JSON(http.StatusOK, []gin.H{})
	}
}

// GetAdminReports возвращает список жалоб пользователей
func GetAdminReports(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: В будущем можно добавить модель Report
		// Пока возвращаем пустой массив
		c.JSON(http.StatusOK, []gin.H{})
	}
}

// GetAdminModQueue возвращает очередь модерации
func GetAdminModQueue(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: В будущем можно добавить модель ModerationQueue
		// Пока возвращаем пустой массив
		c.JSON(http.StatusOK, []gin.H{})
	}
}

// ApproveModItem одобряет элемент в очереди модерации
func ApproveModItem(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: В будущем реализовать логику одобрения
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
