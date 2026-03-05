package api

import (
	"encoding/json"
	"net/http"
	"safegram-server/internal/email"
	"safegram-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func checkAdminOrOwnerAccess(userRoles string) bool {
	var roles []string
	if err := json.Unmarshal([]byte(userRoles), &roles); err != nil {
		return userRoles == "admin" || userRoles == "owner"
	}
	for _, role := range roles {
		if role == "admin" || role == "owner" { return true }
	}
	return false
}

func SendPersonalEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !checkAdminOrOwnerAccess(user.Roles) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin or owner role required"})
			return
		}
		var req struct {
			UserID     string `json:"userId" binding:"required"`
			Message    string `json:"message" binding:"required"`
			ActionText string `json:"actionText"`
			ActionLink string `json:"actionLink"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
			return
		}
		var targetUser models.User
		if err := db.Where("id = ?", req.UserID).First(&targetUser).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target user not found"})
			return
		}
		if targetUser.Email == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Target user has no email address"})
			return
		}
		to, uname, msg, atext, alink := *targetUser.Email, targetUser.Username, req.Message, req.ActionText, req.ActionLink
		go func() { _ = email.SendAdminMessage(to, uname, msg, atext, alink) }()
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Email sent successfully", "to": to})
	}
}

func BroadcastPersonalEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !checkAdminOrOwnerAccess(user.Roles) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin or owner role required"})
			return
		}
		var req struct {
			UserIDs    []string `json:"userIds" binding:"required"`
			Message    string   `json:"message" binding:"required"`
			ActionText string   `json:"actionText"`
			ActionLink string   `json:"actionLink"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
			return
		}
		msg, atext, alink := req.Message, req.ActionText, req.ActionLink
		for _, targetUserID := range req.UserIDs {
			var targetUser models.User
			if err := db.Where("id = ?", targetUserID).First(&targetUser).Error; err != nil {
				continue
			}
			if targetUser.Email == nil {
				continue
			}
			to, uname := *targetUser.Email, targetUser.Username
			go func() { _ = email.SendAdminMessage(to, uname, msg, atext, alink) }()
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Рассылка запущена"})
	}
}

func SendMaintenanceNotificationToAll(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !checkAdminOrOwnerAccess(user.Roles) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin or owner role required"})
			return
		}
		var req struct {
			Timestamp string `json:"timestamp" binding:"required"`
			Message   string `json:"message" binding:"required"`
			SendEmail bool   `json:"sendEmail"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
			return
		}
		maintenance := models.MaintenanceMode{
			ID:        uuid.New().String(),
			IsActive:  true,
			Timestamp: req.Timestamp,
			Message:   req.Message,
		}
		if err := db.Create(&maintenance).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "errorCode": "MAINTENANCE_SAVE_FAILED"})
			return
		}
		response := gin.H{"success": true, "message": "Maintenance mode activated", "data": maintenance}
		if req.SendEmail {
			var users []models.User
			if err := db.Find(&users).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "errorCode": "USERS_FETCH_FAILED"})
				return
			}
			ts, msg := req.Timestamp, req.Message
			for _, targetUser := range users {
				if targetUser.Email == nil {
					continue
				}
				to, uname := *targetUser.Email, targetUser.Username
				go func() { _ = email.SendMaintenanceNotification(to, uname, ts, msg) }()
			}
			response["emailsQueued"] = len(users)
		}
		c.JSON(http.StatusOK, response)
	}
}

func GetMaintenanceStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var maintenance models.MaintenanceMode
		db.Where("is_active = ?", true).Order("created_at DESC").Limit(1).Find(&maintenance)
		if maintenance.ID == "" {
			c.JSON(http.StatusOK, gin.H{"isActive": false, "enabled": false, "message": ""})
			return
		}
		c.JSON(http.StatusOK, gin.H{"isActive": maintenance.IsActive, "enabled": maintenance.IsActive, "timestamp": maintenance.Timestamp, "message": maintenance.Message, "id": maintenance.ID, "createdAt": maintenance.CreatedAt})
	}
}

func DisableMaintenance(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !checkAdminOrOwnerAccess(user.Roles) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin or owner role required"})
			return
		}
		if err := db.Model(&models.MaintenanceMode{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "errorCode": "MAINTENANCE_UPDATE_FAILED"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Maintenance mode disabled"})
	}
}