package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/config"
	"safegram-server/internal/crypto"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
)

// RegisterRequest структура запроса регистрации
type RegisterRequest struct {
	Username       string `json:"username" binding:"required,min=3"`
	Password       string `json:"password" binding:"required,min=4"`
	Email          string `json:"email"`
	EmailCode      string `json:"emailCode"`
	NeedsCloudCode bool   `json:"needsCloudCode"`
	Pin            string `json:"pin"` // опционально: облачный код (PIN) для входа, 4–12 символов
}

// LoginRequest структура запроса входа
type LoginRequest struct {
	UsernameOrEmail string `json:"usernameOrEmail"` // Поддержка старого SPA/Next
	Username        string `json:"username"`        // Предпочтительное поле (новый фронт)
	Password        string `json:"password" binding:"required"`
	EmailCode       string `json:"emailCode"` // Код подтверждения email
	CloudCode       string `json:"cloudCode"` // Облачный код (PIN)
}

// Register обрабатывает регистрацию пользователя
func Register(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}

		// Проверка существования пользователя
		var existingUser models.User
		if err := db.Where("LOWER(username) = LOWER(?)", req.Username).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_exists"})
			return
		}

		// Проверка существования email
		if req.Email != "" {
			var existingEmail models.User
			if err := db.Where("LOWER(email) = LOWER(?)", req.Email).First(&existingEmail).Error; err == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "email_exists"})
				return
			}
		}

		// Если нужен облачный код, проверяем его
		if req.NeedsCloudCode && req.Email != "" {
			if req.EmailCode == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "email_code_required"})
				return
			}
			// Проверяем код
			valid, err := VerifyEmailCode(req.Email, req.EmailCode)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
				return
			}
			if !valid {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
				return
			}
		}

		// Хеширование пароля
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Создание пользователя
		user := models.User{
			ID:           uuid.New().String(),
			Username:     req.Username,
			PassHash:     string(hashedPassword),
			Plan:         "free",
			Status:       "online",
			ProfileColor: "#3b82f6",
			ShowBio:      true,
			ShowAvatar:   true,
		}
		// Устанавливаем email только если он не пустой (чтобы избежать конфликта уникального индекса)
		if strings.TrimSpace(req.Email) != "" {
			email := strings.TrimSpace(req.Email)
			user.Email = &email
		}

		// Опционально: PIN (облачный код) для входа
		if pin := strings.TrimSpace(req.Pin); len(pin) >= 4 && len(pin) <= 12 {
			pinHash, errPin := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
			if errPin == nil {
				user.PinHash = string(pinHash)
			}
		}

		// Владелец: первый зарегистрированный или username "lev"
		user.Roles = "[]"
		var ownerCount int64
		db.Model(&models.User{}).Where("roles LIKE ?", "%owner%").Count(&ownerCount)
		if ownerCount == 0 || strings.EqualFold(strings.TrimSpace(req.Username), "lev") {
			user.SetRoles([]string{"owner"})
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Mnemonic 12 слов: генерируем при регистрации, возвращаем один раз, в БД не сохраняем.
		// Приватный ключ выводится только в RAM из сида на клиенте/устройстве.
		mnemonicWords, _ := crypto.GenerateMnemonic12()
		mnemonicResponse := strings.Join(mnemonicWords, " ")

		// Генерация JWT токена
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

		session, _ := CreateSession(db, user.ID, tokenString, c.ClientIP(), c.GetHeader("User-Agent"))
		resp := gin.H{
			"token":    tokenString,
			"mnemonic": mnemonicResponse,
			"user": gin.H{
				"id":       user.ID,
				"username": user.Username,
				"status":   user.Status,
				"roles":    user.ParseRoles(),
			},
		}
		if session != nil {
			resp["sessionId"] = session.ID
		}
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			queueEmailJob("welcome_email", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendWelcomeEmail(emailAddress, user.Username, premiumAppURL())
			})
		}
		c.JSON(http.StatusOK, resp)
	}
}

// Login обрабатывает вход пользователя
func Login(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Поиск пользователя по логину или email
		var user models.User
		login := strings.TrimSpace(req.Username)
		if login == "" {
			login = strings.TrimSpace(req.UsernameOrEmail)
		}
		if login == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_creds"})
			return
		}

		q := db
		if strings.Contains(login, "@") {
			// Введён email
			q = q.Where("LOWER(email) = LOWER(?)", login)
		} else {
			// Введён логин
			q = q.Where("LOWER(username) = LOWER(?)", login)
		}

		if err := q.First(&user).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_creds"})
			return
		}

		// Проверка пароля
		if err := bcrypt.CompareHashAndPassword([]byte(user.PassHash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_creds"})
			return
		}

		// Если у пользователя есть email, требуется подтверждение
		if user.Email != nil && *user.Email != "" {
			// Если код email не предоставлен — 200 с флагом, чтобы не было 401 в сети
			if req.EmailCode == "" {
				c.JSON(http.StatusOK, gin.H{
					"error":        "email_verification_required",
					"message":      "Требуется подтверждение email",
					"hasEmail":     true,
					"hasCloudCode": user.PinHash != "",
				})
				return
			}

			// Проверяем код email
			valid, err := VerifyEmailCode(*user.Email, req.EmailCode)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
				return
			}
			if !valid {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_email_code"})
				return
			}

			// Если есть облачный код (PIN), проверяем его
			if user.PinHash != "" {
				cloudCode := strings.TrimSpace(req.CloudCode)
				if cloudCode == "" {
					c.JSON(http.StatusOK, gin.H{
						"error":        "cloud_code_required",
						"message":      "Требуется облачный код",
						"hasCloudCode": true,
					})
					return
				}
				if err := bcrypt.CompareHashAndPassword([]byte(user.PinHash), []byte(cloudCode)); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_cloud_code"})
					return
				}
			}
		} else {
			// Если email нет, вход без подтверждения
			if user.PinHash != "" {
				cloudCode := strings.TrimSpace(req.CloudCode)
				if cloudCode == "" {
					c.JSON(http.StatusOK, gin.H{
						"error":        "cloud_code_required",
						"message":      "Требуется облачный код",
						"hasCloudCode": true,
					})
					return
				}
				if err := bcrypt.CompareHashAndPassword([]byte(user.PinHash), []byte(cloudCode)); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_cloud_code"})
					return
				}
			}
		}

		// Блокируем вход для забаненных аккаунтов
		if strings.EqualFold(strings.TrimSpace(user.Status), "banned") {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "user_banned",
				"message": "Ваш аккаунт заблокирован администрацией.",
			})
			return
		}

		// Генерация JWT токена
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

		session, errSession := CreateSession(db, user.ID, tokenString, c.ClientIP(), c.GetHeader("User-Agent"))
		if errSession != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		roles := user.ParseRoles()
		resp := gin.H{
			"token": tokenString,
			"user": gin.H{
				"id":       user.ID,
				"username": user.Username,
				"status":   user.Status,
				"roles":    roles,
			},
		}
		if session != nil {
			resp["sessionId"] = session.ID
		}
		recordSuspiciousActivity(db, user.ID, "new_login", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"login": login,
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			ip := c.ClientIP()
			device := c.GetHeader("User-Agent")
			queueEmailJob("login_notification", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
				"ip":     ip,
			}, func() error {
				return email.SendLoginNotification(emailAddress, user.Username, ip, device)
			})
		}
		c.JSON(http.StatusOK, resp)
	}
}
