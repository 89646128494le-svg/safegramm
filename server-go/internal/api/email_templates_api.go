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
		appURL := "https://safegram-hazel.vercel.app"

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
		case "backup_regenerated":
			err = email.SendBackupCodesRegenerated(req.Email, username, "SAFE-888111\nSAFE-888222\nSAFE-888333\nSAFE-888444\nSAFE-888555")
		case "email_change_verify":
			err = email.SendEmailChangeVerification(req.Email, username, "908112")
		case "email_changed":
			err = email.SendEmailChangedNotification(req.Email, username, req.Email)
		case "premium_receipt":
			err = email.SendPremiumReceipt(req.Email, username, "SafeGram Premium", "$9.99", "09.03.2026 23:30")
		case "premium_expiring":
			err = email.SendPremiumExpiring(req.Email, username, "SafeGram Premium", "16.03.2026 23:59", appURL+"/app/settings/billing")
		case "export_ready":
			err = email.SendAccountExportReady(req.Email, username, appURL+"/download/export/demo", "24 часа")
		case "account_deleted":
			err = email.SendAccountDeletedConfirmation(req.Email, username, appURL+"/support")
		case "digest":
			err = email.SendUnreadDigest(req.Email, username, 4, 19, appURL+"/app/chats")
		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "unknown_template",
				"available": []string{
					"verification", "welcome", "login", "reset", "changed", "message",
					"group_invite", "security", "locked", "premium", "backup",
					"backup_regenerated", "email_change_verify", "email_changed",
					"premium_receipt", "premium_expiring", "export_ready",
					"account_deleted", "digest",
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
