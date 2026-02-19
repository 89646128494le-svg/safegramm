package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetTrustScore возвращает уровень доверия сессии (для отображения в UI).
func GetTrustScore(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		var user models.User
		if err := db.Select("id", "two_fa_secret").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		identityVerified := user.TwoFASecret != ""
		sessionVerified := true
		c.JSON(http.StatusOK, gin.H{
			"identityVerified": identityVerified,
			"sessionVerified":  sessionVerified,
		})
	}
}
