package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/models"
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
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetUserProfile возвращает профиль пользователя
func GetUserProfile(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Если это не свой профиль, скрываем приватные данные
		if userID != currentUserID {
			if !user.ShowAvatar {
				user.AvatarURL = ""
			}
			if !user.ShowBio {
				user.About = ""
			}
		}

		c.JSON(http.StatusOK, gin.H{"user": user})
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

		c.JSON(http.StatusOK, gin.H{
			"privacy": gin.H{
				"showBio":    user.ShowBio,
				"showAvatar": user.ShowAvatar,
				"lastSeen":   "everyone", // можно расширить
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
			ShowBio    *bool `json:"showBio"`
			ShowAvatar *bool `json:"showAvatar"`
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

		if len(updates) > 0 {
			db.Model(&models.User{}).Where("id = ?", userIDStr).Updates(updates)
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

