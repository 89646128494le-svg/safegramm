package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
	"gorm.io/gorm"
	"safegram-server/internal/config"
	"safegram-server/internal/models"
)

const admin2FATokenHeader = "X-Admin-2FA-Token"
const admin2FATokenPurpose = "admin_2fa"
const admin2FATokenExpiry = 1 * time.Hour

type admin2FAClaims struct {
	jwt.RegisteredClaims
	Purpose string `json:"purpose"`
}

// GetAdmin2FAStatus возвращает, включена ли у текущего админа 2FA (без проверки кода).
// Роут: только RequireAdmin, без RequireAdmin2FA.
func GetAdmin2FAStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		var user models.User
		if err := db.Select("two_fa_secret").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"twoFactorEnabled": user.TwoFASecret != ""})
	}
}

// PostAdminVerify2FA проверяет код 2FA и возвращает токен для доступа в админку.
// Роут: только RequireAdmin.
func PostAdminVerify2FA(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		var req struct {
			Code string `json:"code" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "code required"})
			return
		}
		var user models.User
		if err := db.Select("two_fa_secret").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if user.TwoFASecret == "" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "2fa_required",
				"message": "Для доступа в админку необходимо включить двухфакторную аутентификацию в настройках.",
			})
			return
		}
		if !totp.Validate(req.Code, user.TwoFASecret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_code", "message": "Неверный код"})
			return
		}
		token, err := signAdmin2FAToken(userIDStr, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "token": token})
	}
}

func signAdmin2FAToken(userID, secret string) (string, error) {
	claims := admin2FAClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(admin2FATokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Purpose: admin2FATokenPurpose,
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(secret))
}

func verifyAdmin2FAToken(tokenString, secret, expectedUserID string) bool {
	t, err := jwt.ParseWithClaims(tokenString, &admin2FAClaims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return false
	}
	claims, ok := t.Claims.(*admin2FAClaims)
	return ok && t.Valid && claims.Purpose == admin2FATokenPurpose && claims.Subject == expectedUserID
}

// RequireAdmin2FA проверяет после RequireAdmin: у пользователя должна быть включена 2FA,
// и в заголовке X-Admin-2FA-Token передан валидный токен (после ввода кода).
// Если 2FA не включена — 403 с сообщением включить 2FA.
// Если 2FA включена, но токена нет или он неверный — 401 с указанием ввести код.
func RequireAdmin2FA(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			c.Abort()
			return
		}
		var user models.User
		if err := db.Select("two_fa_secret").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			c.Abort()
			return
		}
		if user.TwoFASecret == "" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "2fa_required",
				"message": "Для доступа в админку необходимо включить двухфакторную аутентификацию в настройках.",
			})
			c.Abort()
			return
		}
		token := c.GetHeader(admin2FATokenHeader)
		if token == "" || !verifyAdmin2FAToken(token, cfg.JWTSecret, userIDStr) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "admin_2fa_verify_required",
				"message": "Введите код двухфакторной аутентификации для входа в админку.",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
