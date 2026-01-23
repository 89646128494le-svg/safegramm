package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetGroupStats статистика группы/канала (чат)
func GetGroupStats(db *gorm.DB) gin.HandlerFunc {
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

		var memberCount int64
		db.Model(&models.ChatMember{}).Where("chat_id = ?", chatID).Count(&memberCount)

		now := time.Now()
		var msgs24h int64
		db.Model(&models.Message{}).Where("chat_id = ? AND created_at > ? AND deleted_at IS NULL AND moderation_status = 'approved'", chatID, now.Add(-24*time.Hour)).Count(&msgs24h)

		var msgs7d int64
		db.Model(&models.Message{}).Where("chat_id = ? AND created_at > ? AND deleted_at IS NULL AND moderation_status = 'approved'", chatID, now.Add(-7*24*time.Hour)).Count(&msgs7d)

		// активные участники за 7 дней (уникальные отправители)
		type row struct{ SenderID string }
		var rows []row
		db.Model(&models.Message{}).
			Select("DISTINCT sender_id").
			Where("chat_id = ? AND created_at > ? AND deleted_at IS NULL AND moderation_status = 'approved'", chatID, now.Add(-7*24*time.Hour)).
			Scan(&rows)

		c.JSON(http.StatusOK, gin.H{
			"members":         memberCount,
			"messages24h":     msgs24h,
			"messages7d":      msgs7d,
			"activeUsers7d":   len(rows),
		})
	}
}

