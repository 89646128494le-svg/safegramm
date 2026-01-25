package api

import (
	"net/http"
	"safegram-server/internal/email"
	"safegram-server/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SendPersonalEmail отправляет персональное письмо пользователю
func SendPersonalEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Проверяем что это админ или владелец
		userID := c.GetString("userID")
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		// Проверяем роли
		hasAccess := false
		for _, role := range user.Roles {
			if role == "admin" || role == "owner" {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
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

		// Получаем пользователя-получателя
		var targetUser models.User
		if err := db.First(&targetUser, req.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target user not found"})
			return
		}

		// Отправляем письмо
		if err := email.SendAdminMessage(targetUser.Email, targetUser.Username, req.Message, req.ActionText, req.ActionLink); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Email sent successfully",
			"to":      targetUser.Email,
		})
	}
}

// BroadcastPersonalEmail отправляет персональное письмо нескольким пользователям
func BroadcastPersonalEmail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Проверяем что это админ или владелец
		userID := c.GetString("userID")
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		// Проверяем роли
		hasAccess := false
		for _, role := range user.Roles {
			if role == "admin" || role == "owner" {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
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

		// Отправляем письма всем пользователям
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

			if err := email.SendAdminMessage(targetUser.Email, targetUser.Username, req.Message, req.ActionText, req.ActionLink); err != nil {
				failedCount++
				errors = append(errors, "Failed to send to "+targetUser.Email+": "+err.Error())
				continue
			}

			successCount++
		}

		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"successCount": successCount,
			"failedCount":  failedCount,
			"errors":       errors,
		})
	}
}

// SendMaintenanceNotification отправляет уведомление о технических работах всем пользователям
func SendMaintenanceNotificationToAll(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Проверяем что это админ или владелец
		userID := c.GetString("userID")
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		// Проверяем роли
		hasAccess := false
		for _, role := range user.Roles {
			if role == "admin" || role == "owner" {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin or owner role required"})
			return
		}

		var req struct {
			Timestamp string `json:"timestamp" binding:"required"` // Время проведения работ
			Message   string `json:"message" binding:"required"`   // Описание работ
			SendEmail bool   `json:"sendEmail"`                    // Отправлять ли email (опционально)
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
			return
		}

		// Сохраняем статус технических работ в базу (создадим модель ниже)
		maintenance := models.MaintenanceMode{
			IsActive:  true,
			Timestamp: req.Timestamp,
			Message:   req.Message,
		}

		if err := db.Create(&maintenance).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save maintenance status: " + err.Error()})
			return
		}

		response := gin.H{
			"success": true,
			"message": "Maintenance mode activated",
			"data":    maintenance,
		}

		// Если нужно отправить email всем пользователям
		if req.SendEmail {
			var users []models.User
			if err := db.Find(&users).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users: " + err.Error()})
				return
			}

			successCount := 0
			failedCount := 0

			for _, targetUser := range users {
				if err := email.SendMaintenanceNotification(targetUser.Email, targetUser.Username, req.Timestamp, req.Message); err != nil {
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

// GetMaintenanceStatus получает текущий статус технических работ
func GetMaintenanceStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var maintenance models.MaintenanceMode
		
		// Получаем последнее активное уведомление о технических работах
		if err := db.Where("is_active = ?", true).Order("created_at DESC").First(&maintenance).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusOK, gin.H{
					"isActive": false,
					"message":  "",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch maintenance status"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"isActive":  maintenance.IsActive,
			"timestamp": maintenance.Timestamp,
			"message":   maintenance.Message,
			"id":        maintenance.ID,
		})
	}
}

// DisableMaintenance отключает режим технических работ
func DisableMaintenance(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Проверяем что это админ или владелец
		userID := c.GetString("userID")
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		// Проверяем роли
		hasAccess := false
		for _, role := range user.Roles {
			if role == "admin" || role == "owner" {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin or owner role required"})
			return
		}

		// Деактивируем все активные уведомления о технических работах
		if err := db.Model(&models.MaintenanceMode{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disable maintenance mode"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Maintenance mode disabled",
		})
	}
}
