package api

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/email"
)

// TestEmailTemplates тестовый endpoint для отправки всех типов писем (только для разработки)
func TestEmailTemplates(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Проверяем, что это development режим
		nodeEnv := os.Getenv("NODE_ENV")
		if nodeEnv != "development" && nodeEnv != "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "only_available_in_development"})
			return
		}

		var req struct {
			Email    string `json:"email" binding:"required,email"`
			Template string `json:"template" binding:"required"`
			Username string `json:"username"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}

		username := req.Username
		if username == "" {
			username = "Тестовый пользователь"
		}

		var err error
		appURL := "https://safegram.app"

		switch req.Template {
		case "verification":
			err = email.SendVerificationCodeWithUsername(req.Email, "123456", username)
		case "welcome":
			err = email.SendWelcomeEmail(req.Email, username, appURL)
		case "login":
			err = email.SendLoginNotification(req.Email, username, "127.0.0.1", "Chrome (Test)")
		case "reset":
			err = email.SendPasswordResetCode(req.Email, username, "654321")
		case "changed":
			err = email.SendPasswordChangedNotification(req.Email, username, "127.0.0.1")
		case "message":
			err = email.SendNewMessageNotification(req.Email, username, "Alice", "Привет! Это тестовое сообщение ✨", "Чат с Alice", appURL+"/app/chats")
		case "group_invite":
			err = email.SendGroupInvite(req.Email, username, "Bob", "SafeGram Fans", appURL+"/app/chats")
		case "security":
			err = email.SendSecurityAlert(req.Email, username, "Подозрительная активность в аккаунте", appURL+"/app/settings")
		case "locked":
			err = email.SendAccountLockedNotification(req.Email, username, "Слишком много попыток входа", appURL+"/support")
		case "premium":
			err = email.SendPremiumActivated(req.Email, username, appURL)
		case "backup":
			err = email.SendBackupCodes(req.Email, username, "SAFE-111111\nSAFE-222222\nSAFE-333333\nSAFE-444444\nSAFE-555555")
		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "unknown_template",
				"available": []string{
					"verification", "welcome", "login", "reset", "changed", "message",
					"group_invite", "security", "locked", "premium", "backup",
				},
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "send_failed", "detail": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

