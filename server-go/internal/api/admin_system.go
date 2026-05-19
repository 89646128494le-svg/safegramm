package api

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetAdminBots — список всех ботов платформы (для админов)
func GetAdminBots(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.UserBot
		if err := db.Order("created_at DESC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, b := range list {
			out[i] = gin.H{
				"id": b.ID, "userId": b.UserID, "username": b.Username,
				"name": b.Name, "isActive": b.IsActive, "createdAt": b.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"bots": out})
	}
}

// PostAdminBotDisable — отключить бота (is_active = false)
func PostAdminBotDisable(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var b models.UserBot
		if err := db.First(&b, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		db.Model(&b).Update("is_active", false)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// PostAdminBotEnable — включить бота
func PostAdminBotEnable(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var b models.UserBot
		if err := db.First(&b, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		db.Model(&b).Update("is_active", true)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminLimits — настройки лимитов
func GetAdminLimits(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.SystemLimit
		db.Find(&list)
		out := make(map[string]string)
		for _, l := range list {
			out[l.Key] = l.Value
		}
		if _, ok := out["file_size_mb"]; !ok {
			out["file_size_mb"] = "100"
		}
		if _, ok := out["group_members_max"]; !ok {
			out["group_members_max"] = "10000"
		}
		if _, ok := out["bots_per_user"]; !ok {
			out["bots_per_user"] = "20"
		}
		c.JSON(http.StatusOK, gin.H{"limits": out})
	}
}

// PatchAdminLimits — обновить лимиты
func PatchAdminLimits(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req map[string]string
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		for k, v := range req {
			var l models.SystemLimit
			if err := db.Where("key = ?", k).First(&l).Error; err != nil {
				l = models.SystemLimit{ID: uuid.New().String(), Key: k, Value: v}
				db.Create(&l)
			} else {
				l.Value = v
				db.Save(&l)
			}
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminFeatureFlags — feature flags
func GetAdminFeatureFlags(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.FeatureFlag
		db.Find(&list)
		out := make([]gin.H, len(list))
		for i, f := range list {
			out[i] = gin.H{
				"id": f.ID, "key": f.Key, "enabled": f.Enabled,
				"roles": f.Roles, "plans": f.Plans, "percent": f.Percent,
			}
		}
		c.JSON(http.StatusOK, gin.H{"flags": out})
	}
}

// PostAdminFeatureFlag — создать флаг
func PostAdminFeatureFlag(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Key     string `json:"key"`
			Enabled bool   `json:"enabled"`
			Roles   string `json:"roles"`
			Plans   string `json:"plans"`
			Percent int    `json:"percent"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Key == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		f := models.FeatureFlag{
			ID: uuid.New().String(), Key: req.Key, Enabled: req.Enabled,
			Roles: req.Roles, Plans: req.Plans, Percent: req.Percent,
		}
		if f.Percent == 0 {
			f.Percent = 100
		}
		if err := db.Create(&f).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "duplicate"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": f.ID, "key": f.Key})
	}
}

// PatchAdminFeatureFlag — обновить
func PatchAdminFeatureFlag(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var f models.FeatureFlag
		if err := db.First(&f, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		var req struct {
			Enabled *bool   `json:"enabled"`
			Roles   *string `json:"roles"`
			Plans   *string `json:"plans"`
			Percent *int    `json:"percent"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if req.Enabled != nil {
			f.Enabled = *req.Enabled
		}
		if req.Roles != nil {
			f.Roles = *req.Roles
		}
		if req.Plans != nil {
			f.Plans = *req.Plans
		}
		if req.Percent != nil {
			f.Percent = *req.Percent
		}
		db.Save(&f)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// Helper: проверка feature flag для пользователя (для использования в других хендлерах)
func isFeatureEnabledForUser(db *gorm.DB, key string, user *models.User) bool {
	var f models.FeatureFlag
	if err := db.First(&f, "key = ?", key).Error; err != nil || !f.Enabled {
		return false
	}
	if f.Percent < 100 {
		// A/B: по хешу user ID
		return int(user.ID[0])%100 < f.Percent
	}
	if f.Roles != "" {
		var roles []string
		_ = json.Unmarshal([]byte(f.Roles), &roles)
		for _, r := range user.ParseRoles() {
			for _, fr := range roles {
				if r == fr {
					return true
				}
			}
		}
		return false
	}
	if f.Plans != "" {
		var plans []string
		_ = json.Unmarshal([]byte(f.Plans), &plans)
		for _, p := range plans {
			if user.Plan == p {
				return true
			}
		}
		return false
	}
	return true
}
