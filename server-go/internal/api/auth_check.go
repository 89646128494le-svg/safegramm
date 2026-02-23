package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CheckUsername не раскрывает, занят ли username (анти-пробив: нельзя перебирать логины).
// Всегда возвращаем available: true; при регистрации вернём username_taken при конфликте.
func CheckUsername(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := strings.TrimSpace(c.Query("username"))
		if len(username) < 3 {
			c.JSON(http.StatusOK, gin.H{"available": true})
			return
		}
		c.JSON(http.StatusOK, gin.H{"available": true})
	}
}

// CheckEmail не раскрывает, зарегистрирован ли email (анти-пробив: нельзя пробивать по почте).
// Всегда available: true; при регистрации вернём email_exists при конфликте.
func CheckEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"available": true})
	}
}
