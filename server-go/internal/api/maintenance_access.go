package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

var maintenanceBypassUsernames = map[string]struct{}{
	"lev":   {},
	"ra40k": {},
}

func normalizeMaintenanceUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

func isMaintenanceBypassUsername(username string) bool {
	_, ok := maintenanceBypassUsernames[normalizeMaintenanceUsername(username)]
	return ok
}

func getActiveMaintenance(db *gorm.DB) (*models.MaintenanceMode, error) {
	var maintenance models.MaintenanceMode
	if err := db.Where("is_active = ?", true).Order("created_at DESC").First(&maintenance).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &maintenance, nil
}

func resolveMaintenanceBypassLogin(db *gorm.DB, login string) bool {
	login = strings.TrimSpace(login)
	if login == "" {
		return false
	}
	if isMaintenanceBypassUsername(login) {
		return true
	}

	var user models.User
	query := db.Select("username")
	if strings.Contains(login, "@") {
		query = query.Where("LOWER(email) = LOWER(?)", login)
	} else {
		query = query.Where("LOWER(username) = LOWER(?)", login)
	}
	if err := query.First(&user).Error; err != nil {
		return false
	}

	return isMaintenanceBypassUsername(user.Username)
}

func maintenanceBlockResponse(c *gin.Context, maintenance *models.MaintenanceMode) {
	message := "Сейчас ведутся технические работы. Откройте страницу статуса и попробуйте позже."
	if maintenance != nil && strings.TrimSpace(maintenance.Message) != "" {
		message = maintenance.Message
	}

	response := gin.H{
		"error":      "maintenance_active",
		"message":    message,
		"statusPage": "/status",
	}
	if maintenance != nil {
		response["isActive"] = maintenance.IsActive
		response["timestamp"] = maintenance.Timestamp
		response["id"] = maintenance.ID
	}

	c.JSON(http.StatusServiceUnavailable, response)
	c.Abort()
}

func ensurePublicMaintenanceAllowed(c *gin.Context, db *gorm.DB, login string) bool {
	maintenance, err := getActiveMaintenance(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		c.Abort()
		return false
	}
	if maintenance == nil {
		return true
	}
	if resolveMaintenanceBypassLogin(db, login) {
		return true
	}
	maintenanceBlockResponse(c, maintenance)
	return false
}

func ensurePublicMaintenanceDisabled(c *gin.Context, db *gorm.DB) bool {
	maintenance, err := getActiveMaintenance(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		c.Abort()
		return false
	}
	if maintenance == nil {
		return true
	}
	maintenanceBlockResponse(c, maintenance)
	return false
}

func MaintenanceAccessMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		maintenance, err := getActiveMaintenance(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			c.Abort()
			return
		}
		if maintenance == nil {
			c.Next()
			return
		}

		if isMaintenanceBypassUsername(c.GetString("username")) {
			c.Next()
			return
		}

		maintenanceBlockResponse(c, maintenance)
	}
}
