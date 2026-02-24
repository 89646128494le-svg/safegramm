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

// SearchUsers возвращает пользователей: (1) по ID если запрос похож на UUID, (2) с AllowFindByUsername=true по имени, (3) контакты по имени (даже если скрыты из поиска).
func SearchUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := strings.TrimSpace(c.Query("q"))
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "query_empty"})
			return
		}

		userID, _ := c.Get("userID")
		userIDStr, _ := userID.(string)
		searchTerm := "%" + strings.ToLower(query) + "%"
		seen := make(map[string]bool)
		var users []models.User

		// Поиск по точному ID (UUID) — один символ не ищем, 2+ ок
		if len(query) >= 32 && strings.Contains(query, "-") {
			var byID models.User
			if err := db.First(&byID, "id = ?", query).Error; err == nil {
				// Показываем по ID только если: в контактах или разрешил поиск
				inContacts := false
				if userIDStr != "" {
					var c int64
					db.Model(&models.Contact{}).Where("user_id = ? AND contact_id = ?", userIDStr, byID.ID).Count(&c)
					inContacts = c > 0
				}
				if byID.AllowFindByUsername || inContacts {
					seen[byID.ID] = true
					users = append(users, byID)
				}
			}
		}

		if len(query) < 2 && len(users) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "query_too_short"})
			return
		}

		// Пользователи, разрешившие показ в поиске (по имени)
		var public []models.User
		db.Where("allow_find_by_username = ?", true).
			Where("LOWER(username) LIKE ?", searchTerm).
			Limit(20).
			Find(&public)
		for _, u := range public {
			if !seen[u.ID] {
				seen[u.ID] = true
				users = append(users, u)
			}
		}

		// Контакты текущего пользователя по запросу (можно найти даже если скрыты из поиска)
		if userIDStr != "" && len(users) < 20 {
			var contactIDs []string
			db.Model(&models.Contact{}).Where("user_id = ?", userIDStr).Pluck("contact_id", &contactIDs)
			if len(contactIDs) > 0 {
				var contacts []models.User
				db.Where("id IN ?", contactIDs).Where("LOWER(username) LIKE ?", searchTerm).Find(&contacts)
				for _, u := range contacts {
					if !seen[u.ID] {
						seen[u.ID] = true
						users = append(users, u)
						if len(users) >= 20 {
							break
						}
					}
				}
			}
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

