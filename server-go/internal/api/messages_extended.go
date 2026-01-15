package api

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/websocket"
)

// AddLocation добавляет геолокацию к сообщению
func AddLocation(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var message models.Message
		if err := db.First(&message, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что это сообщение пользователя
		if message.SenderID != userIDStr {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			Lat     float64 `json:"lat" binding:"required"`
			Lng     float64 `json:"lng" binding:"required"`
			Address string  `json:"address"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Обновляем сообщение
		db.Model(&message).Updates(map[string]interface{}{
			"location_lat": req.Lat,
			"location_lon": req.Lng,
		})

		// Отправляем через WebSocket
		updateJSON, _ := json.Marshal(gin.H{
			"type":      "message_update",
			"messageId": messageID,
			"data":      message,
		})
		wsHub.BroadcastToChat(message.ChatID, updateJSON)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

