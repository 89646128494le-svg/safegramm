package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetAdminUserSessions — активные сессии пользователя
func GetAdminUserSessions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var list []models.Session
		if err := db.Where("user_id = ?", userID).Order("last_used DESC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, s := range list {
			out[i] = gin.H{
				"id":        s.ID,
				"ipAddress": s.IPAddress,
				"userAgent": s.UserAgent,
				"device":    s.Device,
				"lastUsed":  s.LastUsed,
				"createdAt": s.CreatedAt,
				"expiresAt": s.ExpiresAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"sessions": out})
	}
}

// DeleteAdminUserSession — принудительный выход пользователя с сессии
func DeleteAdminUserSession(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		sessionID := c.Param("sid")
		res := db.Where("id = ? AND user_id = ?", sessionID, userID).Delete(&models.Session{})
		if res.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminSuspiciousActivity — лог подозрительных действий
func GetAdminSuspiciousActivity(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Query("userId")
		tx := db.Model(&models.SuspiciousActivity{})
		if userID != "" {
			tx = tx.Where("user_id = ?", userID)
		}
		var list []models.SuspiciousActivity
		if err := tx.Order("created_at DESC").Limit(200).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, a := range list {
			out[i] = gin.H{
				"id":        a.ID,
				"userId":   a.UserID,
				"action":   a.Action,
				"ip":       a.IP,
				"userAgent": a.UserAgent,
				"details":  a.Details,
				"createdAt": a.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": out})
	}
}

// GetAdminSecurityPolicy — настройки политики паролей и 2FA
func GetAdminSecurityPolicy(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p models.SecurityPolicy
		if err := db.First(&p).Error; err != nil {
			// дефолт
			p = models.SecurityPolicy{
				ID:                    uuid.New().String(),
				Require2FAForAdmins:   false,
				SessionMaxDays:        30,
				PasswordMinLength:     8,
				PasswordRequireSpecial: false,
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"require2FAForAdmins":   p.Require2FAForAdmins,
			"sessionMaxDays":       p.SessionMaxDays,
			"passwordMinLength":    p.PasswordMinLength,
			"passwordRequireSpecial": p.PasswordRequireSpecial,
		})
	}
}

// PatchAdminSecurityPolicy — обновить политику
func PatchAdminSecurityPolicy(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Require2FAForAdmins   *bool `json:"require2FAForAdmins"`
			SessionMaxDays       *int  `json:"sessionMaxDays"`
			PasswordMinLength    *int  `json:"passwordMinLength"`
			PasswordRequireSpecial *bool `json:"passwordRequireSpecial"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		var p models.SecurityPolicy
		if err := db.First(&p).Error; err != nil {
			p = models.SecurityPolicy{ID: uuid.New().String()}
			db.Create(&p)
		}
		if req.Require2FAForAdmins != nil {
			p.Require2FAForAdmins = *req.Require2FAForAdmins
		}
		if req.SessionMaxDays != nil {
			p.SessionMaxDays = *req.SessionMaxDays
		}
		if req.PasswordMinLength != nil {
			p.PasswordMinLength = *req.PasswordMinLength
		}
		if req.PasswordRequireSpecial != nil {
			p.PasswordRequireSpecial = *req.PasswordRequireSpecial
		}
		db.Save(&p)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminSafetyAlerts — алерты Safety AI с фильтрами
func GetAdminSafetyAlerts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tx := db.Model(&models.SafetyAlert{})
		if t := c.Query("type"); t != "" {
			tx = tx.Where("type = ?", t)
		}
		if resolved := c.Query("resolved"); resolved == "true" || resolved == "false" {
			tx = tx.Where("resolved = ?", resolved == "true")
		}
		var list []models.SafetyAlert
		if err := tx.Order("created_at DESC").Limit(100).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, a := range list {
			out[i] = gin.H{
				"id":         a.ID,
				"type":      a.Type,
				"userId":    a.UserID,
				"chatId":    a.ChatID,
				"messageId": a.MessageID,
				"payload":   a.Payload,
				"resolved":  a.Resolved,
				"createdAt": a.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"alerts": out})
	}
}

// PostAdminSafetyAlertResolve — отметить алерт как обработанный
func PostAdminSafetyAlertResolve(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		var a models.SafetyAlert
		if err := db.First(&a, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		now := time.Now().UTC()
		db.Model(&a).Updates(map[string]interface{}{
			"resolved": true, "resolved_by": adminIDStr, "resolved_at": now,
		})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminSecuritySessions — все активные сессии (для Security Dashboard).
func GetAdminSecuritySessions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.Session
		if err := db.Preload("User").Where("is_active = ?", true).Order("last_used DESC").Limit(500).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, s := range list {
			username := ""
			if s.User.ID != "" {
				username = s.User.Username
			}
			out[i] = gin.H{
				"id":        s.ID,
				"userId":   s.UserID,
				"username": username,
				"ip":       s.IPAddress,
				"ipAddress": s.IPAddress,
				"userAgent": s.UserAgent,
				"lastActive": s.LastUsed,
				"lastUsed":  s.LastUsed,
				"createdAt": s.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"sessions": out})
	}
}

// GetAdminSecurityAlerts — алерты для Security Dashboard (тот же формат, что safety-alerts).
func GetAdminSecurityAlerts(db *gorm.DB) gin.HandlerFunc {
	return GetAdminSafetyAlerts(db)
}

// GetAdminSecurityBlockedIPs — список заблокированных IP (из in-memory блоклиста).
func GetAdminSecurityBlockedIPs(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		list := globalBlocklist.ListBanned()
		c.JSON(http.StatusOK, gin.H{"ips": list})
	}
}

// PostAdminSecurityBlockIP — ручная блокировка IP через админку.
func PostAdminSecurityBlockIP(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			IP string `json:"ip" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ip_required"})
			return
		}
		ip := strings.TrimSpace(req.IP)
		if ip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ip_required"})
			return
		}
		if globalBlocklist.isWhitelisted(ip) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ip_whitelisted"})
			return
		}
		globalBlocklist.BlockManual(ip)
		c.JSON(http.StatusOK, gin.H{"ok": true, "ip": ip})
	}
}

// PostAdminSecurityUnblockIP — разблокировать IP через админку.
func PostAdminSecurityUnblockIP(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			IP string `json:"ip" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ip_required"})
			return
		}
		ip := strings.TrimSpace(req.IP)
		globalBlocklist.Unblock(ip)
		c.JSON(http.StatusOK, gin.H{"ok": true, "ip": ip})
	}
}
