package api

import (
	"net/http"
	"safegram-server/internal/config"
	"safegram-server/internal/logger"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetWebhookSettings получает текущие настройки webhook
func GetWebhookSettings(c *gin.Context) {
	webhookURL := logger.GetWebhook()
	c.JSON(http.StatusOK, gin.H{
		"webhookURL": webhookURL,
		"enabled":    webhookURL != "",
	})
}

// UpdateWebhookSettings обновляет настройки webhook
func UpdateWebhookSettings(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			WebhookURL string `json:"webhookURL"`
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		
		// Валидация URL
		if req.WebhookURL != "" {
			if !isValidURL(req.WebhookURL) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook URL"})
				return
			}
		}
		
		// Обновляем webhook URL
		logger.SetWebhook(req.WebhookURL)
		
		// Логируем изменение
		userId := c.GetString("userId")
		logger.LogAction("webhook_updated", userId, map[string]interface{}{
			"webhookURL": maskURL(req.WebhookURL),
		})
		
		c.JSON(http.StatusOK, gin.H{
			"success":    true,
			"webhookURL": req.WebhookURL != "",
			"message":    "Webhook settings updated",
		})
	}
}

// TestWebhook отправляет тестовое сообщение на webhook
func TestWebhook(c *gin.Context) {
	logger.Info("Test webhook message", map[string]interface{}{
		"test": true,
		"message": "This is a test message from SafeGram server",
	})
	
	logger.Flush() // Принудительно отправляем
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Test message sent",
	})
}

// GetLogs получает последние логи (для админов)
func GetLogs(c *gin.Context) {
	// В будущем можно добавить сохранение логов в БД и возврат их здесь
	c.JSON(http.StatusOK, gin.H{
		"logs": []interface{}{},
		"message": "Logs are sent to webhook in real-time",
	})
}

func isValidURL(url string) bool {
	return len(url) > 10 && (url[:7] == "http://" || url[:8] == "https://")
}

func maskURL(url string) string {
	if len(url) > 50 {
		return url[:20] + "..." + url[len(url)-20:]
	}
	return url
}
