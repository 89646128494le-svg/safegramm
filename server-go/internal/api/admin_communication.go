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

// GetAdminEmailTemplates — список шаблонов рассылок
func GetAdminEmailTemplates(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.EmailTemplate
		if err := db.Order("name").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, t := range list {
			out[i] = gin.H{
				"id": t.ID, "name": t.Name, "type": t.Type, "subject": t.Subject,
				"active": t.Active, "createdAt": t.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"templates": out})
	}
}

// PostAdminEmailTemplate — создать шаблон
func PostAdminEmailTemplate(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name      string `json:"name"`
			Type      string `json:"type"`
			Subject   string `json:"subject"`
			BodyHTML  string `json:"bodyHtml"`
			BodyText  string `json:"bodyText"`
			Variables string `json:"variables"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		t := models.EmailTemplate{
			ID: uuid.New().String(), Name: req.Name, Type: req.Type,
			Subject: req.Subject, BodyHTML: req.BodyHTML, BodyText: req.BodyText,
			Variables: req.Variables, Active: true,
		}
		if err := db.Create(&t).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"template": gin.H{"id": t.ID, "name": t.Name}})
	}
}

// PatchAdminEmailTemplate — обновить шаблон
func PatchAdminEmailTemplate(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var t models.EmailTemplate
		if err := db.First(&t, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		var req struct {
			Name     *string `json:"name"`
			Subject  *string `json:"subject"`
			BodyHTML *string `json:"bodyHtml"`
			BodyText *string `json:"bodyText"`
			Active   *bool   `json:"active"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if req.Name != nil {
			t.Name = *req.Name
		}
		if req.Subject != nil {
			t.Subject = *req.Subject
		}
		if req.BodyHTML != nil {
			t.BodyHTML = *req.BodyHTML
		}
		if req.BodyText != nil {
			t.BodyText = *req.BodyText
		}
		if req.Active != nil {
			t.Active = *req.Active
		}
		db.Save(&t)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminScheduledBroadcasts — запланированные рассылки
func GetAdminScheduledBroadcasts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.ScheduledBroadcast
		db.Order("scheduled_at ASC").Find(&list)
		out := make([]gin.H, len(list))
		for i, b := range list {
			out[i] = gin.H{
				"id": b.ID, "templateId": b.TemplateID, "subject": b.Subject,
				"scheduledAt": b.ScheduledAt, "sentAt": b.SentAt, "createdBy": b.CreatedBy,
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": out})
	}
}

// PostAdminScheduledBroadcast — запланировать рассылку
func PostAdminScheduledBroadcast(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		var req struct {
			TemplateID  string `json:"templateId"`
			Subject     string `json:"subject"`
			BodyHTML    string `json:"bodyHtml"`
			ScheduledAt string `json:"scheduledAt"`
			FilterPlan  string `json:"filterPlan"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		var at time.Time
		if req.ScheduledAt != "" {
			var err error
			at, err = time.Parse(time.RFC3339, req.ScheduledAt)
			if err != nil {
				at = time.Now().Add(24 * time.Hour)
			}
		} else {
			at = time.Now().Add(24 * time.Hour)
		}
		b := models.ScheduledBroadcast{
			ID: uuid.New().String(), TemplateID: req.TemplateID, Subject: req.Subject,
			BodyHTML: req.BodyHTML, FilterPlan: req.FilterPlan, ScheduledAt: at,
			CreatedBy: adminIDStr,
		}
		db.Create(&b)
		c.JSON(http.StatusOK, gin.H{"id": b.ID, "scheduledAt": b.ScheduledAt})
	}
}

// GetAdminDomainList — чёрный/белый список доменов
func GetAdminDomainList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.DomainAllowBlock
		db.Order("value").Find(&list)
		out := make([]gin.H, len(list))
		for i, d := range list {
			out[i] = gin.H{
				"id": d.ID, "value": d.Value, "isDomain": d.IsDomain,
				"allow": d.Allow, "forInvite": d.ForInvite, "forReg": d.ForReg,
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": out})
	}
}

// PostAdminDomainList — добавить домен/email
func PostAdminDomainList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		var req struct {
			Value     string `json:"value"`
			IsDomain  bool   `json:"isDomain"`
			Allow     bool   `json:"allow"`
			ForInvite bool   `json:"forInvite"`
			ForReg    bool   `json:"forReg"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Value == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		d := models.DomainAllowBlock{
			ID: uuid.New().String(), Value: req.Value, IsDomain: req.IsDomain,
			Allow: req.Allow, ForInvite: req.ForInvite, ForReg: req.ForReg,
			CreatedBy: adminIDStr,
		}
		if err := db.Create(&d).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "duplicate"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": d.ID})
	}
}

// DeleteAdminDomainList — удалить
func DeleteAdminDomainList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if db.Delete(&models.DomainAllowBlock{}, "id = ?", id).RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminInviteLinks — глобальные пригласительные ссылки
func GetAdminInviteLinks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.GlobalInviteLink
		db.Order("created_at DESC").Find(&list)
		out := make([]gin.H, len(list))
		for i, l := range list {
			out[i] = gin.H{
				"id": l.ID, "code": l.Code, "createdBy": l.CreatedBy,
				"inviterName": l.InviterName, "questionnaire": l.Questionnaire,
				"maxUses": l.MaxUses, "usedCount": l.UsedCount,
				"expiresAt": l.ExpiresAt, "active": l.Active, "createdAt": l.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": out})
	}
}

// PostAdminInviteLink — создать ссылку
func PostAdminInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminID, _ := c.Get("userID")
		adminIDStr, _ := adminID.(string)
		var req struct {
			MaxUses       int    `json:"maxUses"`
			ExpiresAt     string `json:"expiresAt"`
			InviterName   string `json:"inviterName"`
			Questionnaire string `json:"questionnaire"`
		}
		c.ShouldBindJSON(&req)
		code := uuid.New().String()[:12]
		var expires *time.Time
		if req.ExpiresAt != "" {
			if t, err := time.Parse(time.RFC3339, req.ExpiresAt); err == nil {
				expires = &t
			}
		}
		l := models.GlobalInviteLink{
			ID: uuid.New().String(), Code: code, CreatedBy: adminIDStr,
			InviterName: strings.TrimSpace(req.InviterName), Questionnaire: strings.TrimSpace(req.Questionnaire),
			MaxUses: req.MaxUses, ExpiresAt: expires, Active: true,
		}
		db.Create(&l)
		c.JSON(http.StatusOK, gin.H{"id": l.ID, "code": l.Code, "url": "/register?invite=" + l.Code})
	}
}

// PatchAdminInviteLink — отозвать (active=false) или обновить лимиты
func PatchAdminInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var l models.GlobalInviteLink
		if err := db.First(&l, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		var req struct {
			Active  *bool `json:"active"`
			MaxUses *int  `json:"maxUses"`
		}
		c.ShouldBindJSON(&req)
		if req.Active != nil {
			l.Active = *req.Active
		}
		if req.MaxUses != nil {
			l.MaxUses = *req.MaxUses
		}
		db.Save(&l)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeleteAdminInviteLink — удалить
func DeleteAdminInviteLink(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if db.Delete(&models.GlobalInviteLink{}, "id = ?", id).RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetInviteByCode — публичный эндпоинт для страницы приглашения (без авторизации)
func GetInviteByCode(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := strings.TrimSpace(c.Param("code"))
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
			return
		}
		var l models.GlobalInviteLink
		if err := db.Where("code = ? AND active = ?", code, true).First(&l).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if l.ExpiresAt != nil && l.ExpiresAt.Before(time.Now()) {
			c.JSON(http.StatusGone, gin.H{"error": "expired"})
			return
		}
		if l.MaxUses > 0 && l.UsedCount >= l.MaxUses {
			c.JSON(http.StatusGone, gin.H{"error": "limit_reached"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"code":          l.Code,
			"inviterName":   l.InviterName,
			"questionnaire": l.Questionnaire,
		})
	}
}
