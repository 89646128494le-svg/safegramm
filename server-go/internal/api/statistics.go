package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetChatStatistics возвращает статистику чата
func GetChatStatistics(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, что пользователь является участником чата
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "access_denied"})
			return
		}

		// Подсчет общей статистики
		var totalMessages int64
		db.Model(&models.Message{}).Where("chat_id = ? AND deleted_at IS NULL", chatID).Count(&totalMessages)

		var totalMedia int64
		db.Model(&models.Message{}).
			Where("chat_id = ? AND deleted_at IS NULL AND attachment_url != ''", chatID).
			Count(&totalMedia)

		var totalReactions int64
		db.Model(&models.MessageReaction{}).
			Joins("JOIN messages ON message_reactions.message_id = messages.id").
			Where("messages.chat_id = ? AND messages.deleted_at IS NULL", chatID).
			Count(&totalReactions)

		// Сообщения по дням (последние 30 дней)
		type DayStat struct {
			Date  string `json:"date"`
			Count int64  `json:"count"`
		}
		var messagesByDay []DayStat
		// Используем TO_CHAR для PostgreSQL или DATE_FORMAT для MySQL
		db.Model(&models.Message{}).
			Select("TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count").
			Where("chat_id = ? AND deleted_at IS NULL AND created_at >= ?", chatID, time.Now().AddDate(0, 0, -30)).
			Group("TO_CHAR(created_at, 'YYYY-MM-DD')").
			Order("date ASC").
			Scan(&messagesByDay)

		// Сообщения по часам
		type HourStat struct {
			Hour  int   `json:"hour"`
			Count int64 `json:"count"`
		}
		var messagesByHour []HourStat
		// Используем EXTRACT для PostgreSQL или HOUR для MySQL
		db.Model(&models.Message{}).
			Select("EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as count").
			Where("chat_id = ? AND deleted_at IS NULL", chatID).
			Group("EXTRACT(HOUR FROM created_at)").
			Order("hour ASC").
			Scan(&messagesByHour)

		// Заполняем пропущенные часы нулями
		hourMap := make(map[int]int64)
		for _, h := range messagesByHour {
			hourMap[h.Hour] = h.Count
		}
		messagesByHour = make([]HourStat, 24)
		for i := 0; i < 24; i++ {
			messagesByHour[i] = HourStat{Hour: i, Count: hourMap[i]}
		}

		// Топ участников
		type ParticipantStat struct {
			UserID            string `json:"userId"`
			Username         string `json:"username"`
			MessageCount     int64  `json:"messageCount"`
			ReactionsGiven   int64  `json:"reactionsGiven"`
			ReactionsReceived int64 `json:"reactionsReceived"`
		}
		var topParticipants []ParticipantStat
		db.Model(&models.Message{}).
			Select("messages.sender_id as user_id, users.username, COUNT(messages.id) as message_count").
			Joins("JOIN users ON messages.sender_id = users.id").
			Where("messages.chat_id = ? AND messages.deleted_at IS NULL", chatID).
			Group("messages.sender_id, users.username").
			Order("message_count DESC").
			Limit(10).
			Scan(&topParticipants)

		// Подсчет реакций для каждого участника
		for i := range topParticipants {
			// Реакции, которые участник получил
			db.Model(&models.MessageReaction{}).
				Joins("JOIN messages ON message_reactions.message_id = messages.id").
				Where("messages.sender_id = ? AND messages.chat_id = ? AND messages.deleted_at IS NULL", topParticipants[i].UserID, chatID).
				Count(&topParticipants[i].ReactionsReceived)

			// Реакции, которые участник поставил
			db.Model(&models.MessageReaction{}).
				Where("user_id = ?", topParticipants[i].UserID).
				Joins("JOIN messages ON message_reactions.message_id = messages.id").
				Where("messages.chat_id = ? AND messages.deleted_at IS NULL", chatID).
				Count(&topParticipants[i].ReactionsGiven)
		}

		// Тренд активности (последние 30 дней)
		type ActivityTrend struct {
			Date     string `json:"date"`
			Messages int64  `json:"messages"`
			Media    int64  `json:"media"`
		}
		var activityTrend []ActivityTrend
		db.Model(&models.Message{}).
			Select("TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as messages").
			Where("chat_id = ? AND deleted_at IS NULL AND created_at >= ?", chatID, time.Now().AddDate(0, 0, -30)).
			Group("TO_CHAR(created_at, 'YYYY-MM-DD')").
			Order("date ASC").
			Scan(&activityTrend)

		// Добавляем количество медиа для каждого дня
		for i := range activityTrend {
			db.Model(&models.Message{}).
				Where("chat_id = ? AND TO_CHAR(created_at, 'YYYY-MM-DD') = ? AND deleted_at IS NULL AND attachment_url != ''", chatID, activityTrend[i].Date).
				Count(&activityTrend[i].Media)
		}

		c.JSON(http.StatusOK, gin.H{
			"totalMessages":    totalMessages,
			"totalMedia":       totalMedia,
			"totalReactions":   totalReactions,
			"messagesByDay":    messagesByDay,
			"messagesByHour":   messagesByHour,
			"topParticipants": topParticipants,
			"activityTrend":    activityTrend,
		})
	}
}
