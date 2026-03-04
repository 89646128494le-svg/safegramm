package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/redis"
)

// UpdateUser обновляет профиль пользователя
func UpdateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Username     string `json:"username"`
			Email        string `json:"email"`
			About        string `json:"about"`
			ProfileColor string `json:"profileColor"`
			ShowBio      *bool  `json:"showBio"`
			ShowAvatar   *bool  `json:"showAvatar"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		updates := make(map[string]interface{})
		if req.Username != "" && req.Username != user.Username {
			// Проверяем уникальность
			var existing models.User
			if err := db.Where("LOWER(username) = LOWER(?) AND id != ?", req.Username, userIDStr).First(&existing).Error; err == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "user_exists"})
				return
			}
			updates["username"] = req.Username
		}
		if req.Email != "" {
			email := strings.TrimSpace(req.Email)
			updates["email"] = &email
		}
		if req.About != "" {
			updates["about"] = req.About
		}
		if req.ProfileColor != "" {
			updates["profile_color"] = req.ProfileColor
		}
		if req.ShowBio != nil {
			updates["show_bio"] = *req.ShowBio
		}
		if req.ShowAvatar != nil {
			updates["show_avatar"] = *req.ShowAvatar
		}

		if len(updates) > 0 {
			db.Model(&user).Updates(updates)
		}

		db.First(&user, "id = ?", userIDStr)
		c.JSON(http.StatusOK, gin.H{"user": user})
	}
}

// UpdateUserStatus обновляет статус пользователя
func UpdateUserStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Status string `json:"status" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		allowedStatuses := []string{"online", "offline", "away", "busy", "invisible"}
		valid := false
		for _, s := range allowedStatuses {
			if req.Status == s {
				valid = true
				break
			}
		}
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "Invalid status"})
			return
		}

		now := time.Now()
		updates := map[string]interface{}{
			"status": req.Status,
		}
		if req.Status == "offline" {
			updates["last_seen"] = &now
		}

		db.Model(&models.User{}).Where("id = ?", userIDStr).Updates(updates)
		c.JSON(http.StatusOK, gin.H{"ok": true, "status": req.Status})
	}
}

// ChangePassword меняет пароль пользователя
func ChangePassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			OldPassword string `json:"oldPassword" binding:"required"`
			NewPassword string `json:"newPassword" binding:"required,min=4"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем старый пароль
		if err := bcrypt.CompareHashAndPassword([]byte(user.PassHash), []byte(req.OldPassword)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_creds"})
			return
		}

		// Хешируем новый пароль
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		db.Model(&user).Update("pass_hash", string(hashedPassword))

		// Инвалидируем все остальные сессии пользователя (текущая остаётся)
		currentSessionID, _ := c.Get("sessionId")
		if sid, ok := currentSessionID.(string); ok && sid != "" {
			db.Model(&models.Session{}).
				Where("user_id = ? AND id != ? AND is_active = ?", userIDStr, sid, true).
				Update("is_active", false)
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "otherSessionsRevoked": true})
	}
}

// GetUserProfile возвращает профиль. Для чужих: никогда не отдаём email; avatar/bio/lastSeen по настройкам приватности.
func GetUserProfile(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")
		currentStr, _ := currentUserID.(string)
		cacheKey := "profile:" + userID + ":" + currentStr
		if cached, err := redis.CacheGet(cacheKey); err == nil && cached != "" {
			c.Data(http.StatusOK, "application/json", []byte(cached))
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		isSelf := userID == currentStr
		if isSelf {
			body := gin.H{"user": user}
			if b, err := json.Marshal(body); err == nil {
				redis.CacheSet(cacheKey, string(b), time.Minute)
			}
			c.JSON(http.StatusOK, body)
			return
		}

		// Чужой профиль: без email; avatar/bio по настройкам; lastSeen по LastSeenVisibility
		profile := gin.H{
			"id":            user.ID,
			"username":      user.Username,
			"avatarUrl":     "",
			"about":         "",
			"status":        user.Status,
			"profileColor":  user.ProfileColor,
			"plan":          user.Plan,
			"createdAt":     user.CreatedAt,
			"lastSeen":     nil,
		}
		if user.ShowAvatar {
			profile["avatarUrl"] = user.AvatarURL
		}
		if user.ShowBio {
			profile["about"] = user.About
		}
		switch user.LastSeenVisibility {
		case "everyone":
			profile["lastSeen"] = user.LastSeen
		case "contacts":
			var ct models.Contact
			if db.Where("user_id = ? AND contact_id = ?", userID, currentStr).First(&ct).Error == nil {
				profile["lastSeen"] = user.LastSeen
			}
		default:
			// nobody
		}
		body := gin.H{"user": profile}
		if b, err := json.Marshal(body); err == nil {
			redis.CacheSet(cacheKey, string(b), time.Minute)
		}
		c.JSON(http.StatusOK, body)
	}
}

// GetUserNotifications возвращает настройки уведомлений
func GetUserNotifications(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Пока возвращаем дефолтные настройки
		c.JSON(http.StatusOK, gin.H{
			"notifications": gin.H{
				"messages":      true,
				"mentions":      true,
				"reactions":     false,
				"calls":         true,
				"groups":        true,
				"servers":       true,
				"email":         false,
				"push":          true,
			},
		})
	}
}

// UpdateUserNotifications обновляет настройки уведомлений
func UpdateUserNotifications(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Пока просто подтверждаем
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetUserPrivacy возвращает настройки приватности
func GetUserPrivacy(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var user models.User
		db.First(&user, "id = ?", userIDStr)
		lastSeen := user.LastSeenVisibility
		if lastSeen == "" {
			lastSeen = "nobody"
		}

		c.JSON(http.StatusOK, gin.H{
			"privacy": gin.H{
				"showBio":              user.ShowBio,
				"showAvatar":           user.ShowAvatar,
				"lastSeenVisibility":   lastSeen,
				"allowFindByUsername":   user.AllowFindByUsername,
			},
		})
	}
}

// UpdateUserPrivacy обновляет настройки приватности
func UpdateUserPrivacy(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			ShowBio              *bool   `json:"showBio"`
			ShowAvatar           *bool   `json:"showAvatar"`
			LastSeenVisibility   *string `json:"lastSeenVisibility"`
			AllowFindByUsername  *bool   `json:"allowFindByUsername"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		updates := make(map[string]interface{})
		if req.ShowBio != nil {
			updates["show_bio"] = *req.ShowBio
		}
		if req.ShowAvatar != nil {
			updates["show_avatar"] = *req.ShowAvatar
		}
		if req.LastSeenVisibility != nil {
			v := *req.LastSeenVisibility
			if v == "nobody" || v == "contacts" || v == "everyone" {
				updates["last_seen_visibility"] = v
			}
		}
		if req.AllowFindByUsername != nil {
			updates["allow_find_by_username"] = *req.AllowFindByUsername
		}

		if len(updates) > 0 {
			db.Model(&models.User{}).Where("id = ?", userIDStr).Updates(updates)
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

