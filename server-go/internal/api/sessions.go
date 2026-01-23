package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetSessions возвращает все активные сессии пользователя
func GetSessions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var sessions []models.Session
		if err := db.Where("user_id = ? AND is_active = ? AND expires_at > ?", userIDStr, true, time.Now()).
			Order("last_used DESC").
			Find(&sessions).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(sessions))
		for i, session := range sessions {
			result[i] = gin.H{
				"id":        session.ID,
				"ipAddress": session.IPAddress,
				"userAgent": session.UserAgent,
				"device":    session.Device,
				"location":  session.Location,
				"lastUsed":  session.LastUsed.Unix() * 1000,
				"createdAt": session.CreatedAt.Unix() * 1000,
				"expiresAt": session.ExpiresAt.Unix() * 1000,
			}
		}

		c.JSON(http.StatusOK, gin.H{"sessions": result})
	}
}

// TerminateSession завершает конкретную сессию
func TerminateSession(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		sessionID := c.Param("id")

		var session models.Session
		if err := db.Where("id = ? AND user_id = ?", sessionID, userIDStr).First(&session).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		session.IsActive = false
		db.Save(&session)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// TerminateAllOtherSessions завершает все другие сессии (кроме текущей)
func TerminateAllOtherSessions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Получаем текущий токен из заголовка
		token := c.GetHeader("Authorization")
		if token != "" && len(token) > 7 {
			token = token[7:] // Убираем "Bearer "
		}

		// Завершаем все сессии кроме текущей
		db.Model(&models.Session{}).
			Where("user_id = ? AND token != ? AND is_active = ?", userIDStr, token, true).
			Update("is_active", false)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// CreateSession создает новую сессию (используется при логине)
func CreateSession(db *gorm.DB, userID, token, ipAddress, userAgent string) (*models.Session, error) {
	device := "web"
	if userAgent != "" {
		// Простое определение устройства
		if contains(userAgent, "Mobile") || contains(userAgent, "Android") || contains(userAgent, "iPhone") {
			device = "mobile"
		} else if contains(userAgent, "Tablet") || contains(userAgent, "iPad") {
			device = "tablet"
		}
	}

	session := models.Session{
		ID:        uuid.New().String(),
		UserID:    userID,
		Token:     token,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Device:    device,
		IsActive:  true,
		LastUsed:  time.Now(),
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour), // 30 дней
	}

	if err := db.Create(&session).Error; err != nil {
		return nil, err
	}

	return &session, nil
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || 
		(len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || 
		containsHelper(s, substr))))
}

func containsHelper(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
