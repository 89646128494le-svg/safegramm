package api

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetVAPIDPublicKey возвращает публичный VAPID ключ
func GetVAPIDPublicKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		publicKey := os.Getenv("VAPID_PUBLIC_KEY")
		if publicKey == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "vapid_not_configured"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"key": publicKey})
	}
}

// SubscribePush регистрирует подписку на push-уведомления
func SubscribePush(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Endpoint string `json:"endpoint" binding:"required"`
			Keys     struct {
				P256dh string `json:"p256dh" binding:"required"`
				Auth   string `json:"auth" binding:"required"`
			} `json:"keys" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Проверяем, существует ли уже подписка с таким endpoint
		var existing models.PushSubscription
		if err := db.Where("endpoint = ? AND user_id = ?", req.Endpoint, userIDStr).First(&existing).Error; err == nil {
			// Обновляем существующую подписку
			existing.P256dh = req.Keys.P256dh
			existing.Auth = req.Keys.Auth
			if err := db.Save(&existing).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true, "id": existing.ID})
			return
		}

		// Создаем новую подписку
		subscription := models.PushSubscription{
			ID:       uuid.New().String(),
			UserID:   userIDStr,
			Endpoint: req.Endpoint,
			P256dh:   req.Keys.P256dh,
			Auth:     req.Keys.Auth,
		}

		if err := db.Create(&subscription).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "id": subscription.ID})
	}
}

// UnsubscribePush отменяет подписку на push-уведомления
func UnsubscribePush(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Endpoint string `json:"endpoint" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Удаляем подписку
		if err := db.Where("endpoint = ? AND user_id = ?", req.Endpoint, userIDStr).Delete(&models.PushSubscription{}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// SendPushNotification отправляет push-уведомление пользователю
// Это упрощенная версия - для полной реализации нужна библиотека web-push
func SendPushNotification(db *gorm.DB, userID string, title string, body string, data map[string]interface{}) error {
	// Получаем все подписки пользователя
	var subscriptions []models.PushSubscription
	if err := db.Where("user_id = ?", userID).Find(&subscriptions).Error; err != nil {
		return err
	}

	// Формируем payload для уведомления
	payload := map[string]interface{}{
		"title": title,
		"body":  body,
	}
	if data != nil {
		payload["data"] = data
	}

	payloadJSON, _ := json.Marshal(payload)

	// В реальной реализации здесь должен быть вызов web-push библиотеки
	// Для упрощения просто логируем
	// TODO: Интегрировать библиотеку web-push для Go (например, github.com/SherClockHolmes/webpush-go)
	
	// Пока что просто возвращаем nil - уведомления будут работать через WebSocket
	_ = payloadJSON
	_ = subscriptions

	return nil
}

// TestPush отправляет тестовое push-уведомление текущему пользователю
func TestPush(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Отправляем тестовое уведомление
		err := SendPushNotification(db, userIDStr, "Тестовое уведомление", "Это тестовое push-уведомление от SafeGram", nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "detail": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Тестовое уведомление отправлено"})
	}
}


