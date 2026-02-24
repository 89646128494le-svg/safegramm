package api

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"safegram-server/internal/config"
	"safegram-server/internal/logger"
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

// GetLogs получает последние логи (для админов).
// Источники: 1) LOG_FILE — последние 300 строк из файла; 2) иначе — подсказка про webhook/stdout.
func GetLogs(c *gin.Context) {
	logPath := os.Getenv("LOG_FILE")
	if logPath == "" {
		c.JSON(http.StatusOK, gin.H{
			"logs": []interface{}{},
			"message": "Set LOG_FILE in .env to see file logs here. Otherwise check process stdout (journalctl -u <service>, docker logs, or terminal).",
		})
		return
	}
	logPath = filepath.Clean(logPath)
	f, err := os.Open(logPath)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"logs": []interface{}{},
			"message": "LOG_FILE not readable: " + err.Error(),
		})
		return
	}
	defer f.Close()
	var lines []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		lines = append(lines, sc.Text())
	}
	if err := sc.Err(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"logs": []interface{}{},
			"message": "Read error: " + err.Error(),
		})
		return
	}
	const lastN = 300
	start := 0
	if len(lines) > lastN {
		start = len(lines) - lastN
	}
	lastLines := lines[start:]
	c.JSON(http.StatusOK, gin.H{
		"logs":    lastLines,
		"message": fmt.Sprintf("Last %d lines from LOG_FILE", len(lastLines)),
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
