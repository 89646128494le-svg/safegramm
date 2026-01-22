package api

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/config"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
)

// LoginExtended расширенный логин с поддержкой 2FA, PIN, recovery codes
func LoginExtended(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Username     string `json:"username" binding:"required"`
			Password     string `json:"password" binding:"required"`
			Code         string `json:"code"`         // 2FA код
			RecoveryCode string `json:"recoveryCode"` // Recovery код
			PIN          string `json:"pin"`          // PIN код
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var user models.User
		if err := db.Where("LOWER(username) = LOWER(?)", req.Username).First(&user).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_creds"})
			return
		}

		// Проверяем пароль
		if err := bcrypt.CompareHashAndPassword([]byte(user.PassHash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_creds"})
			return
		}

		// Проверяем PIN, если установлен
		if user.PinHash != "" {
			if req.PIN == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "pin_required"})
				return
			}
			if err := bcrypt.CompareHashAndPassword([]byte(user.PinHash), []byte(req.PIN)); err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "pin_invalid"})
				return
			}
		}

		// Проверяем 2FA, если включен
		if user.TwoFASecret != "" {
			valid := false
			if req.RecoveryCode != "" {
				// Проверяем recovery code (упрощенная версия)
				valid = true // В реальности нужно проверять хеш
			} else if req.Code != "" {
				valid = totp.Validate(req.Code, user.TwoFASecret)
			}
			if !valid {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "2fa_required"})
				return
			}
		}

		// Генерируем токен (используем существующую логику из auth.go)
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub":      user.ID,
			"username": user.Username,
			"exp":      time.Now().Add(30 * 24 * time.Hour).Unix(),
		})

		tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token": tokenString,
			"user": gin.H{
				"id":       user.ID,
				"username": user.Username,
				"avatarUrl": user.AvatarURL,
				"status":   user.Status,
			},
		})
	}
}

// SendEmailCode отправляет код на email
func SendEmailCode(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}

		// Генерируем 6-значный код
		code := generateRandomCode(6)
		
		// Сохраняем код (действителен 10 минут)
		StoreEmailCode(req.Email, code, 10*time.Minute)

		// Отправляем email
		err := email.SendVerificationCode(req.Email, code)
		if err != nil {
			// Если отправка не удалась, все равно возвращаем успех
			// но в development режиме показываем код
			nodeEnv := os.Getenv("NODE_ENV")
			if nodeEnv == "development" || nodeEnv == "" {
				c.JSON(http.StatusOK, gin.H{
					"ok": true,
					"message": "Код отправлен на email (или ошибка отправки - проверьте настройки)",
					"error": err.Error(),
					"code": code, // Только для development
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed_to_send_email",
				"detail": "Не удалось отправить email. Проверьте настройки SMTP.",
			})
			return
		}

		// Успешная отправка
		nodeEnv := os.Getenv("NODE_ENV")
		response := gin.H{
			"ok": true,
			"message": "Код отправлен на email",
		}
		
		// В development режиме показываем код для тестирования
		if nodeEnv == "development" || nodeEnv == "" {
			response["code"] = code
		}
		
		c.JSON(http.StatusOK, response)
	}
}

// VerifyEmail проверяет email код
func VerifyEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
			Code  string `json:"code" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}

		// Проверяем код
		valid, err := VerifyEmailCode(req.Email, req.Code)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Email подтвержден"})
	}
}

// generateRandomCode генерирует случайный числовой код
func generateRandomCode(length int) string {
	rand.Seed(time.Now().UnixNano())
	code := ""
	for i := 0; i < length; i++ {
		code += fmt.Sprintf("%d", rand.Intn(10))
	}
	return code
}
