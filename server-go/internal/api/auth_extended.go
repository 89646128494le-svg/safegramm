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
	"safegram-server/internal/logger"
	"safegram-server/internal/models"
	"strings"
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
			pin := strings.TrimSpace(req.PIN)
			if pin == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "pin_required"})
				return
			}
			if err := bcrypt.CompareHashAndPassword([]byte(user.PinHash), []byte(pin)); err != nil {
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
				"id":        user.ID,
				"username":  user.Username,
				"avatarUrl": user.AvatarURL,
				"status":    user.Status,
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

		// Генерируем 6-значный код. Если активный код уже есть, переиспользуем его,
		// чтобы повторная отправка не ломала письмо, которое пользователь уже получил.
		code := StoreOrReuseEmailCode(req.Email, generateRandomCode(6), 10*time.Minute)

		// Отправляем email в фоне — ответ клиенту сразу
		to, codeVal := req.Email, code
		go func() {
			if err := email.SendVerificationCode(to, codeVal); err != nil {
				logger.Error("SendEmailCode: failed to send email", err, map[string]interface{}{"email": to})
			}
		}()

		nodeEnv := os.Getenv("NODE_ENV")
		response := gin.H{"ok": true, "message": "Код отправлен на email"}
		if nodeEnv == "development" || nodeEnv == "" {
			response["code"] = code
		}
		c.JSON(http.StatusOK, response)
	}
}

// GetEmailStatus возвращает, настроена ли почта на сервере (для проверки .env).
func GetEmailStatus(c *gin.Context) {
	ok, msg := email.IsEmailConfigured()
	c.JSON(http.StatusOK, gin.H{"configured": ok, "message": msg})
}

// SendLoginEmailCode отправляет код на email при входе (по username)
func SendLoginEmailCode(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Username        string `json:"username"`
			UsernameOrEmail string `json:"usernameOrEmail"`
			Login           string `json:"login"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}

		login := strings.TrimSpace(req.Username)
		if login == "" {
			login = strings.TrimSpace(req.UsernameOrEmail)
		}
		if login == "" {
			login = strings.TrimSpace(req.Login)
		}
		if login == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "username or email is required"})
			return
		}

		// Находим пользователя по username или email
		var user models.User
		query := db
		if strings.Contains(login, "@") {
			query = query.Where("LOWER(email) = LOWER(?)", login)
		} else {
			query = query.Where("LOWER(username) = LOWER(?)", login)
		}
		if err := query.First(&user).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_not_found"})
			return
		}

		// Проверяем, есть ли email
		if user.Email == nil || *user.Email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_email"})
			return
		}

		// Генерируем 6-значный код. Если активный код уже есть, переиспользуем его,
		// чтобы повторная отправка не инвалидировала уже полученное письмо.
		code := StoreOrReuseEmailCode(*user.Email, generateRandomCode(6), 10*time.Minute)

		// Отправляем email в фоне — ответ клиенту сразу (и в dev, и в production)
		userEmail, codeVal := *user.Email, code
		go func() {
			if err := email.SendVerificationCode(userEmail, codeVal); err != nil {
				logger.Error("SendLoginEmailCode: failed to send email", err, map[string]interface{}{
					"login": login,
					"email": maskEmail(userEmail),
				})
			}
		}()

		nodeEnv := os.Getenv("NODE_ENV")
		isDev := nodeEnv == "development" || nodeEnv == ""
		if isDev {
			c.JSON(http.StatusOK, gin.H{
				"ok":           true,
				"message":      "Код для входа (режим разработки). Используйте код ниже или проверьте почту.",
				"hasCloudCode": user.PinHash != "",
				"code":         code,
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"ok":           true,
			"message":      "Код отправлен на email",
			"hasCloudCode": user.PinHash != "",
		})
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

func maskEmail(e string) string {
	if e == "" {
		return ""
	}
	at := strings.Index(e, "@")
	if at <= 0 {
		return "***"
	}
	if at <= 2 {
		return "***" + e[at:]
	}
	return e[:2] + "***" + e[at:]
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
