package api

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"safegram-server/internal/email"
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "errorCode": "TOTP_GENERATE_FAILED"})
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
		var user models.User
		if err := db.Select("id", "username", "email").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
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
		recordSuspiciousActivity(db, user.ID, "2fa_enable", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"issuer": "SafeGram",
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			queueEmailJob("security_alert_2fa_enable", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendSecurityAlert(emailAddress, user.Username, "Two-factor authentication was enabled for your SafeGram account.", settingsURL())
			})
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "2FA enabled"})
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
		recordSuspiciousActivity(db, user.ID, "2fa_disable", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"source": "settings",
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			queueEmailJob("security_alert_2fa_disable", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendSecurityAlert(emailAddress, user.Username, "Two-factor authentication was disabled for your SafeGram account.", settingsURL())
			})
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "2FA disabled"})
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
		var user models.User
		if err := db.Select("id", "username", "email", "recovery_codes").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		hadRecoveryCodes := strings.TrimSpace(user.RecoveryCodes) != "" && strings.TrimSpace(user.RecoveryCodes) != "[]"
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
		recordSuspiciousActivity(db, user.ID, "recovery_codes_generated", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"regenerated": hadRecoveryCodes,
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			codesPayload := strings.Join(codes, "\n")
			if hadRecoveryCodes {
				queueEmailJob("backup_codes_regenerated", map[string]interface{}{
					"userId": user.ID,
					"email":  maskEmail(emailAddress),
				}, func() error {
					return email.SendBackupCodesRegenerated(emailAddress, user.Username, codesPayload)
				})
			} else {
				queueEmailJob("backup_codes_created", map[string]interface{}{
					"userId": user.ID,
					"email":  maskEmail(emailAddress),
				}, func() error {
					return email.SendBackupCodes(emailAddress, user.Username, codesPayload)
				})
			}
			queueEmailJob("security_alert_recovery_codes", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendSecurityAlert(emailAddress, user.Username, "New backup recovery codes were generated for your SafeGram account.", settingsURL())
			})
		}
		c.JSON(http.StatusOK, gin.H{"codes": codes, "message": "Save these codes. Each code can be used only once."})
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
		pin := strings.TrimSpace(req.PIN)
		if len(pin) < 4 || len(pin) > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "PIN must be between 4 and 12 characters"})
			return
		}
		pinHash, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		db.Model(&user).Update("pin_hash", string(pinHash))
		recordSuspiciousActivity(db, user.ID, "pin_set", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"source": "settings",
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			queueEmailJob("security_alert_pin_set", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendSecurityAlert(emailAddress, user.Username, "Cloud PIN was set or updated for your SafeGram account.", settingsURL())
			})
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "PIN set"})
	}
}

func RemovePIN(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req struct {
			Password string `json:"password" binding:"required"`
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
		if strings.TrimSpace(user.PinHash) == "" {
			c.JSON(http.StatusOK, gin.H{"ok": true, "message": "PIN already removed"})
			return
		}

		if err := db.Model(&user).Updates(map[string]interface{}{
			"pin_hash": "",
			"pin_salt": "",
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		recordSuspiciousActivity(db, user.ID, "pin_removed", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"source": "settings",
		})
		if emailAddress := userEmailValue(&user); emailAddress != "" {
			queueEmailJob("security_alert_pin_removed", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendSecurityAlert(emailAddress, user.Username, "Cloud PIN was removed from your SafeGram account.", settingsURL())
			})
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "PIN removed"})
	}
}
