package api

import (
	"net/http"
	"time"

	"safegram-server/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func degradedPublicStatusSummary(now time.Time, errorCode string) gin.H {
	return gin.H{
		"status":      "degraded",
		"generatedAt": now,
		"api": gin.H{
			"ok":    false,
			"error": errorCode,
		},
		"maintenance": gin.H{
			"isActive": false,
			"enabled":  false,
		},
		"systemBanner": gin.H{
			"isActive": false,
			"enabled":  false,
		},
	}
}

func GetPublicStatusSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()

		sqlDB, err := db.DB()
		if err != nil {
			c.JSON(http.StatusOK, degradedPublicStatusSummary(now, "db_pool"))
			return
		}
		if err := sqlDB.Ping(); err != nil {
			c.JSON(http.StatusOK, degradedPublicStatusSummary(now, "db_ping"))
			return
		}

		var maintenance models.MaintenanceMode
		if err := db.Where("is_active = ?", true).Order("created_at DESC").Limit(1).Find(&maintenance).Error; err != nil {
			c.JSON(http.StatusOK, degradedPublicStatusSummary(now, "maintenance_query"))
			return
		}

		banner, err := getLiveSystemBanner(db, now)
		if err != nil {
			c.JSON(http.StatusOK, degradedPublicStatusSummary(now, "system_banner_query"))
			return
		}

		status := "operational"
		if maintenance.ID != "" && maintenance.IsActive {
			status = "maintenance"
		} else if banner != nil {
			switch banner.Severity {
			case "critical":
				status = "critical"
			case "warning":
				status = "warning"
			case "success":
				status = "success"
			default:
				status = "info"
			}
		}

		response := gin.H{
			"status":      status,
			"generatedAt": now,
			"api":         gin.H{"ok": true},
			"maintenance": gin.H{
				"isActive":  maintenance.ID != "" && maintenance.IsActive,
				"enabled":   maintenance.ID != "" && maintenance.IsActive,
				"id":        maintenance.ID,
				"message":   maintenance.Message,
				"timestamp": maintenance.Timestamp,
				"createdAt": maintenance.CreatedAt,
			},
			"systemBanner": gin.H{
				"isActive": false,
				"enabled":  false,
			},
		}

		if banner != nil {
			response["systemBanner"] = gin.H{
				"isActive":    true,
				"enabled":     true,
				"id":          banner.ID,
				"title":       banner.Title,
				"message":     banner.Message,
				"severity":    banner.Severity,
				"dismissible": banner.Dismissible,
				"startsAt":    banner.StartsAt,
				"endsAt":      banner.EndsAt,
				"createdAt":   banner.CreatedAt,
				"updatedAt":   banner.UpdatedAt,
			}
		}

		c.JSON(http.StatusOK, response)
	}
}
