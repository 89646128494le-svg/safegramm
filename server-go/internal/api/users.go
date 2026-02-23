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

// GetUsers возвращает только контактов текущего пользователя (никакого глобального каталога — анти-пробив).
func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var contacts []models.Contact
		if err := db.Where("user_id = ?", userIDStr).Find(&contacts).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		result := make([]gin.H, 0, len(contacts))
		for _, ct := range contacts {
			var u models.User
			if err := db.First(&u, "id = ?", ct.ContactID).Error; err != nil {
				continue
			}
			isOnline, _ := redis.IsOnline(u.ID)
			avatarURL := u.AvatarURL
			if !u.ShowAvatar {
				avatarURL = ""
			}
			result = append(result, gin.H{
				"id":        u.ID,
				"username":  u.Username,
				"avatarUrl": avatarURL,
				"status":    u.Status,
				"isOnline":  isOnline,
			})
		}
		c.JSON(http.StatusOK, gin.H{"users": result})
	}
}

// SearchUsers показывает только пользователей с AllowFindByUsername=true (приватность по умолчанию).
// Никогда не отдаём email/phone; статус/онлайн — только если пользователь разрешил.
func SearchUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := strings.TrimSpace(c.Query("q"))
		if query == "" || len(query) < 3 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "query_too_short"})
			return
		}

		var users []models.User
		searchTerm := "%" + strings.ToLower(query) + "%"
		if err := db.Where("allow_find_by_username = ?", true).
			Where("LOWER(username) LIKE ?", searchTerm).
			Limit(20).
			Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, 0, len(users))
		for _, user := range users {
			avatarURL := user.AvatarURL
			if !user.ShowAvatar {
				avatarURL = ""
			}
			isOnline, _ := redis.IsOnline(user.ID)
			result = append(result, gin.H{
				"id":        user.ID,
				"username":  user.Username,
				"avatarUrl": avatarURL,
				"status":    user.Status,
				"isOnline":  isOnline,
			})
		}
		c.JSON(http.StatusOK, gin.H{"users": result})
	}
}

