package api

import (
	"encoding/json"
	"math/rand"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

func Generate2FA(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var user models.User
		if err := db.Select("id", "username", "email", "two_fa_secret").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if user.TwoFASecret != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "2fa_already_enabled"})
			return
		}
		accountName := user.Username
		if user.Email != nil && *user.Email != "" {
			accountName = *user.Email
		}
		key, err := totp.Generate(totp.GenerateOpts{
			Issuer: "SafeGram", AccountName: accountName, SecretSize: 32,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "detail": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"secret": key.Secret(), "url": key.URL()})
	}
}

func Enable2FA(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var req struct {
			Secret string `json:"secret" binding:"required"`
			Code   string `json:"code" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}
		if !totp.Validate(req.Code, req.Secret) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
			return
		}
		if err := db.Model(&models.User{}).Where("id = ?", userIDStr).Update("two_fa_secret", req.Secret).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "2FA включена"})
	}
}

func Disable2FA(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var req struct {
			Password string `json:"password"`
			Code     string `json:"code"`
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
		if user.TwoFASecret == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "2fa_not_enabled"})
			return
		}
		okPass := req.Password != "" && bcrypt.CompareHashAndPassword([]byte(user.PassHash), []byte(req.Password)) == nil
		okCode := req.Code != "" && totp.Validate(req.Code, user.TwoFASecret)
		if !okPass && !okCode {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_password_or_code"})
			return
		}
		db.Model(&user).Updates(map[string]interface{}{"two_fa_secret": "", "recovery_codes": ""})
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "2FA отключена"})
	}
}

func generateRecoveryCodeChars(length int) string {
	const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
	b := make([]byte, length)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func GenerateRecoveryCodes(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		const numCodes = 10
		codes := make([]string, numCodes)
		hashes := make([]string, numCodes)
		for i := 0; i < numCodes; i++ {
			code := generateRecoveryCodeChars(4) + "-" + generateRecoveryCodeChars(4) + "-" + generateRecoveryCodeChars(4) + "-" + generateRecoveryCodeChars(4)
			codes[i] = code
			hash, _ := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
			hashes[i] = string(hash)
		}
		hashesJSON, _ := json.Marshal(hashes)
		if err := db.Model(&models.User{}).Where("id = ?", userIDStr).Update("recovery_codes", string(hashesJSON)).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"codes": codes, "message": "Сохраните коды. Каждый можно использовать один раз."})
	}
}

func SetPIN(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var req struct {
			Password string `json:"password" binding:"required"`
			PIN      string `json:"pin" binding:"required,min=4,max=12"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}
		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if bcrypt.CompareHashAndPassword([]byte(user.PassHash), []byte(req.Password)) != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_password"})
			return
		}
		pinHash, err := bcrypt.GenerateFromPassword([]byte(req.PIN), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		db.Model(&user).Update("pin_hash", string(pinHash))
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "PIN установлен"})
	}
}
