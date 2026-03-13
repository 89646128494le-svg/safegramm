package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"safegram-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var systemBannerDefaultTitles = map[string]string{
	"info":     "Важное сообщение",
	"success":  "Обновление SafeGram",
	"warning":  "Внимание",
	"critical": "Критическое уведомление",
}

func normalizeSystemBannerSeverity(input string) string {
	switch strings.ToLower(strings.TrimSpace(input)) {
	case "success":
		return "success"
	case "warning":
		return "warning"
	case "critical":
		return "critical"
	default:
		return "info"
	}
}

func parseBannerTime(raw string) (*time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04",
		"2006-01-02 15:04",
	}
	for _, layout := range layouts {
		var (
			parsed time.Time
			err    error
		)
		if layout == time.RFC3339 {
			parsed, err = time.Parse(layout, value)
		} else {
			parsed, err = time.ParseInLocation(layout, value, time.Local)
		}
		if err == nil {
			return &parsed, nil
		}
	}
	return nil, errors.New("invalid time format")
}

func getLiveSystemBanner(db *gorm.DB, now time.Time) (*models.SystemBanner, error) {
	var banner models.SystemBanner
	err := db.
		Where("is_active = ?", true).
		Where("(starts_at IS NULL OR starts_at <= ?)", now).
		Where("(ends_at IS NULL OR ends_at >= ?)", now).
		Order("updated_at DESC").
		First(&banner).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &banner, nil
}

func GetSystemBannerStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		banner, err := getLiveSystemBanner(db, now)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		if banner == nil {
			c.JSON(http.StatusOK, gin.H{"enabled": false, "isActive": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"enabled":     true,
			"isActive":    true,
			"id":          banner.ID,
			"title":       banner.Title,
			"message":     banner.Message,
			"severity":    banner.Severity,
			"dismissible": banner.Dismissible,
			"startsAt":    banner.StartsAt,
			"endsAt":      banner.EndsAt,
			"createdAt":   banner.CreatedAt,
			"updatedAt":   banner.UpdatedAt,
		})
	}
}

func GetAdminSystemBanner(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var banner models.SystemBanner
		err := db.Order("updated_at DESC").First(&banner).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusOK, gin.H{"enabled": false, "isActive": false})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		now := time.Now()
		isLive := banner.IsActive &&
			(banner.StartsAt == nil || !banner.StartsAt.After(now)) &&
			(banner.EndsAt == nil || !banner.EndsAt.Before(now))
		c.JSON(http.StatusOK, gin.H{
			"enabled":     banner.IsActive,
			"isActive":    isLive,
			"id":          banner.ID,
			"title":       banner.Title,
			"message":     banner.Message,
			"severity":    banner.Severity,
			"dismissible": banner.Dismissible,
			"startsAt":    banner.StartsAt,
			"endsAt":      banner.EndsAt,
			"createdAt":   banner.CreatedAt,
			"updatedAt":   banner.UpdatedAt,
		})
	}
}

func UpsertAdminSystemBanner(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !canManageMaintenance(user) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		var req struct {
			Title       string `json:"title"`
			Message     string `json:"message" binding:"required"`
			Severity    string `json:"severity"`
			Dismissible bool   `json:"dismissible"`
			StartsAt    string `json:"startsAt"`
			EndsAt      string `json:"endsAt"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
			return
		}

		startsAt, err := parseBannerTime(req.StartsAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_starts_at"})
			return
		}
		endsAt, err := parseBannerTime(req.EndsAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_ends_at"})
			return
		}
		if startsAt != nil && endsAt != nil && endsAt.Before(*startsAt) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_schedule"})
			return
		}

		severity := normalizeSystemBannerSeverity(req.Severity)
		title := strings.TrimSpace(req.Title)
		if title == "" {
			title = systemBannerDefaultTitles[severity]
		}

		if err := db.Model(&models.SystemBanner{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		banner := models.SystemBanner{
			ID:          uuid.New().String(),
			IsActive:    true,
			Title:       title,
			Message:     strings.TrimSpace(req.Message),
			Severity:    severity,
			Dismissible: req.Dismissible,
			StartsAt:    startsAt,
			EndsAt:      endsAt,
		}
		if err := db.Create(&banner).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "System banner updated",
			"data":    banner,
		})
	}
}

func DisableAdminSystemBanner(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		var user models.User
		if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !canManageMaintenance(user) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
		if err := db.Model(&models.SystemBanner{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "System banner disabled"})
	}
}
