package api

import (
	"bytes"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetChatWebhooks список вебхуков чата (модераторы)
func GetChatWebhooks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var hooks []models.Webhook
		db.Where("scope_type = ? AND scope_id = ?", "chat", chatID).Order("created_at DESC").Find(&hooks)
		c.JSON(http.StatusOK, gin.H{"webhooks": hooks})
	}
}

// CreateChatWebhook создать вебхук (модераторы)
func CreateChatWebhook(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			URL    string `json:"url" binding:"required"`
			Events string `json:"events"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		h := models.Webhook{
			ID:        uuid.New().String(),
			ScopeType: "chat",
			ScopeID:   chatID,
			URL:       req.URL,
			Events:    req.Events,
		}
		if err := db.Create(&h).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		logModeration(db, chatID, "", userIDStr, "webhook_create", "", "", gin.H{"url": req.URL})
		c.JSON(http.StatusOK, gin.H{"webhook": h})
	}
}

// DeleteChatWebhook удалить вебхук (модераторы)
func DeleteChatWebhook(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		webhookID := c.Param("webhookId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if !isChatModerator(member.Role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		db.Delete(&models.Webhook{}, "id = ? AND scope_type = ? AND scope_id = ?", webhookID, "chat", chatID)
		logModeration(db, chatID, "", userIDStr, "webhook_delete", "", "", gin.H{"webhookId": webhookID})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// fireWebhooks отправляет событие вебхукам (без блокировки основного потока)
func fireWebhooks(db *gorm.DB, scopeType, scopeID, event string, payload []byte) {
	var hooks []models.Webhook
	if err := db.Where("scope_type = ? AND scope_id = ?", scopeType, scopeID).Find(&hooks).Error; err != nil {
		return
	}
	if len(hooks) == 0 {
		return
	}
	client := &http.Client{Timeout: 5 * time.Second}
	for _, h := range hooks {
		// фильтр событий (если пусто — считаем что все)
		if h.Events != "" {
			ok := false
			for _, e := range strings.Split(h.Events, ",") {
				e = strings.TrimSpace(e)
				if e == "" {
					continue
				}
				if e == event || e == "*" {
					ok = true
					break
				}
			}
			if !ok {
				continue
			}
		}
		req, err := http.NewRequest("POST", h.URL, bytes.NewBuffer(payload))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		_, _ = client.Do(req)
	}
}

