package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/email"
	"safegram-server/internal/logger"
	"safegram-server/internal/models"
)

const passwordResetExpiry = 15 * time.Minute

// ForgotPasswordRequest запрос на отправку кода восстановления
type ForgotPasswordRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
}

// ForgotPassword отправляет на email код для сброса пароля (email или username)
func ForgotPassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ForgotPasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "Укажите email или имя пользователя"})
			return
		}
		emailStr := strings.TrimSpace(req.Email)
		username := strings.TrimSpace(req.Username)
		if emailStr == "" && username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "Укажите email или имя пользователя"})
			return
		}

		var user models.User
		if emailStr != "" {
			if err := db.Where("LOWER(email) = LOWER(?)", emailStr).First(&user).Error; err != nil {
				c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Если аккаунт с таким email есть, на него отправлено письмо"})
				return
			}
		} else {
			if err := db.Where("LOWER(username) = LOWER(?)", username).First(&user).Error; err != nil {
				c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Если аккаунт с таким именем есть, на почту отправлено письмо"})
				return
			}
			if user.Email == nil || *user.Email == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "no_email", "detail": "У этого аккаунта не указана почта. Восстановление невозможно."})
				return
			}
			emailStr = *user.Email
		}

		ok, _ := email.IsEmailConfigured()
		if !ok {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email_not_configured", "detail": "Отправка писем временно недоступна"})
			return
		}

		code := generateRandomCode(6)
		StorePasswordResetCode(emailStr, code, passwordResetExpiry)
		to, uname, codeVal := emailStr, user.Username, code
		go func() {
			if err := email.SendPasswordResetCode(to, uname, codeVal); err != nil {
				logger.Error("ForgotPassword: failed to send email", err, map[string]interface{}{"email": maskEmail(to)})
				return
			}
			logger.Info("ForgotPassword: reset code sent", map[string]interface{}{"email": maskEmail(to)})
		}()
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Код восстановления отправлен на вашу почту"})
	}
}

// ResetPasswordRequest запрос на сброс пароля по коду
type ResetPasswordRequest struct {
	Email       string `json:"email" binding:"required"`
	Code        string `json:"code" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=4"`
}

// ResetPassword устанавливает новый пароль по коду из письма
func ResetPassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ResetPasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}
		emailStr := strings.TrimSpace(req.Email)
		if !VerifyAndConsumePasswordResetCode(emailStr, req.Code) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code", "detail": "Неверный или истёкший код"})
			return
		}

		var user models.User
		if err := db.Where("LOWER(email) = LOWER(?)", emailStr).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		if err := db.Model(&user).Update("pass_hash", string(hashed)).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		logger.Info("ResetPassword: password changed", map[string]interface{}{"userId": user.ID})
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Пароль успешно изменён. Войдите с новым паролем."})
	}
}
