package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// ListContacts возвращает список контактов текущего пользователя с данными контактов (User).
func ListContacts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var list []models.Contact
		if err := db.Where("user_id = ?", userIDStr).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		result := make([]gin.H, 0, len(list))
		for _, ct := range list {
			var u models.User
			if err := db.First(&u, "id = ?", ct.ContactID).Error; err != nil {
				continue
			}
			result = append(result, gin.H{
				"id":       u.ID,
				"username": u.Username,
				"avatarUrl": u.AvatarURL,
				"status":   u.Status,
			})
		}
		c.JSON(http.StatusOK, gin.H{"contacts": result})
	}
}

// ContactsSearch — поиск пользователей для добавления в контакты (тот же SearchUsers).
func ContactsSearch(db *gorm.DB) gin.HandlerFunc {
	return SearchUsers(db)
}

// AddContact — добавить пользователя в контакты.
func AddContact(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var body struct {
			UserID string `json:"userId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if body.UserID == userIDStr {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_add_self"})
			return
		}
		var u models.User
		if err := db.First(&u, "id = ?", body.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
			return
		}
		var existing models.Contact
		if err := db.Where("user_id = ? AND contact_id = ?", userIDStr, body.UserID).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"ok": true})
			return
		}
		contact := models.NewContact(userIDStr, body.UserID)
		if err := db.Create(&contact).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// RemoveContact — удалить пользователя из контактов.
func RemoveContact(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var body struct {
			UserID string `json:"userId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		db.Where("user_id = ? AND contact_id = ?", userIDStr, body.UserID).Delete(&models.Contact{})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
