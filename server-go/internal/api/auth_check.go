package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CheckUsername проверяет доступность логина при регистрации (GET ?username=...)
func CheckUsername(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := strings.TrimSpace(c.Query("username"))
		if len(username) < 3 {
			c.JSON(http.StatusOK, gin.H{"available": false, "reason": "short"})
			return
		}
		var existing models.User
		if err := db.Where("LOWER(username) = LOWER(?)", username).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"available": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"available": true})
	}
}

// CheckEmail проверяет доступность email при регистрации (GET ?email=...)
func CheckEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		email := strings.TrimSpace(c.Query("email"))
		if email == "" {
			c.JSON(http.StatusOK, gin.H{"available": true})
			return
		}
		var existing models.User
		if err := db.Where("LOWER(email) = LOWER(?)", email).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"available": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"available": true})
	}
}
