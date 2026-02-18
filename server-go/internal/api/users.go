package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/redis"
)

// GetCurrentUser возвращает текущего пользователя (статус онлайн — из Redis).
func GetCurrentUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		roles := user.ParseRoles()
		status := user.Status
		if isOnline, _ := redis.IsOnline(user.ID); isOnline {
			status = "online"
		} else if status == "" {
			status = "offline"
		}

		c.JSON(http.StatusOK, gin.H{
			"id":           user.ID,
			"username":     user.Username,
			"roles":        roles,
			"plan":         user.Plan,
			"avatarUrl":    user.AvatarURL,
			"about":        user.About,
			"status":       status,
			"profileColor": user.ProfileColor,
			"showBio":      user.ShowBio,
			"showAvatar":   user.ShowAvatar,
			"lastSeen":     user.LastSeen,
		})
	}
}

// GetUsers возвращает список всех пользователей (для загрузки контактов)
func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User
		if err := db.Limit(1000).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(users))
		for i, user := range users {
			// Проверяем онлайн статус через Redis
			isOnline, _ := redis.IsOnline(user.ID)
			result[i] = gin.H{
				"id":       user.ID,
				"username": user.Username,
				"avatarUrl": user.AvatarURL,
				"status":   user.Status,
				"isOnline": isOnline,
			}
		}

		c.JSON(http.StatusOK, gin.H{"users": result})
	}
}

// SearchUsers ищет пользователей
func SearchUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var users []models.User
		searchTerm := "%" + strings.ToLower(query) + "%"
		if err := db.Where("LOWER(username) LIKE ?", searchTerm).
			Limit(20).
			Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(users))
		for i, user := range users {
			// Проверяем онлайн статус через Redis
			isOnline, _ := redis.IsOnline(user.ID)
			result[i] = gin.H{
				"id":       user.ID,
				"username": user.Username,
				"avatarUrl": user.AvatarURL,
				"status":   user.Status,
				"isOnline": isOnline,
			}
		}

		c.JSON(http.StatusOK, gin.H{"users": result})
	}
}

