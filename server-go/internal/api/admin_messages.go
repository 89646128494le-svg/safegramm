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
		if err := db.First(&user, userID).Error; err != nil {
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
		if err := db.First(&targetUser, req.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target user not found"})
			return
		}
		if targetUser.Email == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Target user has no email address"})
			return
		}
		if err := email.SendAdminMessage(*targetUser.Email, targetUser.Username, req.Message, req.ActionText, req.ActionLink); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Email sent successfully", "to": *targetUser.Email})
	}
}

func BroadcastPersonalEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
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
		successCount := 0
		failedCount := 0
		var errors []string
		for _, targetUserID := range req.UserIDs {
			var targetUser models.User
			if err := db.First(&targetUser, targetUserID).Error; err != nil {
				failedCount++
				errors = append(errors, "User "+targetUserID+" not found")
				continue
			}
			if targetUser.Email == nil {
				failedCount++
				errors = append(errors, "User "+targetUserID+" has no email")
				continue
			}
			if err := email.SendAdminMessage(*targetUser.Email, targetUser.Username, req.Message, req.ActionText, req.ActionLink); err != nil {
				failedCount++
				errors = append(errors, "Failed to send to "+*targetUser.Email+": "+err.Error())
				continue
			}
			successCount++
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "successCount": successCount, "failedCount": failedCount, "errors": errors})
	}
}

func SendMaintenanceNotificationToAll(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save maintenance status: " + err.Error()})
			return
		}
		response := gin.H{"success": true, "message": "Maintenance mode activated", "data": maintenance}
		if req.SendEmail {
			var users []models.User
			if err := db.Find(&users).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users: " + err.Error()})
				return
			}
			successCount := 0
			failedCount := 0
			for _, targetUser := range users {
				if targetUser.Email == nil { continue }
				if err := email.SendMaintenanceNotification(*targetUser.Email, targetUser.Username, req.Timestamp, req.Message); err != nil {
					failedCount++
					continue
				}
				successCount++
			}
			response["emailsSent"] = successCount
			response["emailsFailed"] = failedCount
		}
		c.JSON(http.StatusOK, response)
	}
}

func GetMaintenanceStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var maintenance models.MaintenanceMode
		if err := db.Where("is_active = ?", true).Order("created_at DESC").First(&maintenance).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusOK, gin.H{"isActive": false, "message": ""})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch maintenance status"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"isActive": maintenance.IsActive, "timestamp": maintenance.Timestamp, "message": maintenance.Message, "id": maintenance.ID})
	}
}

func DisableMaintenance(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !checkAdminOrOwnerAccess(user.Roles) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin or owner role required"})
			return
		}
		if err := db.Model(&models.MaintenanceMode{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disable maintenance mode"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Maintenance mode disabled"})
	}
}