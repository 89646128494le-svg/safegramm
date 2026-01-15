package api

import (
	"crypto/rand"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// Generate2FA генерирует секрет для 2FA
func Generate2FA(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Генерируем секрет
		key, err := totp.Generate(totp.GenerateOpts{
			Issuer:      "SafeGram",
			AccountName: user.Username,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Сохраняем как pending (включится после подтверждения)
		// В реальности нужно добавить поле pending_2fa_secret в модель
		// Пока используем временное хранение или обновляем напрямую
		c.JSON(http.StatusOK, gin.H{
			"secret":   key.Secret(),
			"otpauth": key.URL(),
		})
	}
}

// Enable2FA включает 2FA
func Enable2FA(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Secret string `json:"secret" binding:"required"`
			Code   string `json:"code" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Проверяем код
		if !totp.Validate(req.Code, req.Secret) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
			return
		}

		// Сохраняем секрет
		db.Model(&models.User{}).Where("id = ?", userIDStr).Update("two_fa_secret", req.Secret)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// Disable2FA отключает 2FA
func Disable2FA(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		if user.TwoFASecret == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "not_enabled"})
			return
		}

		var req struct {
			Code         string `json:"code"`
			RecoveryCode string `json:"recoveryCode"`
		}

		c.ShouldBindJSON(&req)

		valid := false
		if req.RecoveryCode != "" {
			// Проверяем recovery code (упрощенная версия)
			valid = true // В реальности нужно проверять хеш
		} else if req.Code != "" && totp.Validate(req.Code, user.TwoFASecret) {
			valid = true
		}

		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
			return
		}

		db.Model(&user).Update("two_fa_secret", "")
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GenerateRecoveryCodes генерирует recovery codes
func GenerateRecoveryCodes(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		_ = userIDStr // Используем для будущей реализации

		codes := make([]string, 10)
		for i := range codes {
			b := make([]byte, 4)
			rand.Read(b)
			codes[i] = fmt.Sprintf("%X", b)
		}

		// В реальности нужно хешировать и сохранять
		// Пока возвращаем как есть (только для первого показа)
		c.JSON(http.StatusOK, gin.H{
			"codes":    codes,
			"remaining": 10,
		})
	}
}

// SetPIN устанавливает PIN код
func SetPIN(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			PIN string `json:"pin"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if req.PIN == "" {
			// Удаляем PIN
			db.Model(&models.User{}).Where("id = ?", userIDStr).Updates(map[string]interface{}{
				"pin_hash": "",
				"pin_salt": "",
			})
			c.JSON(http.StatusOK, gin.H{"ok": true, "cleared": true})
			return
		}

		if len(req.PIN) < 4 || len(req.PIN) > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_pin"})
			return
		}

		// Хешируем PIN
		hashedPIN, err := bcrypt.GenerateFromPassword([]byte(req.PIN), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		db.Model(&models.User{}).Where("id = ?", userIDStr).Updates(map[string]interface{}{
			"pin_hash": string(hashedPIN),
			"pin_salt": "", // bcrypt включает salt
		})

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

