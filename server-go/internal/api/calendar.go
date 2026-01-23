package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CalendarEvent представляет событие календаря
type CalendarEvent struct {
	ID              string   `json:"id"`
	Title           string   `json:"title"`
	Description     string   `json:"description,omitempty"`
	StartTime       int64    `json:"startTime"`
	EndTime         *int64   `json:"endTime,omitempty"`
	ChatID          string   `json:"chatId,omitempty"`
	Participants    []string `json:"participants,omitempty"`
	ReminderMinutes int      `json:"reminderMinutes,omitempty"`
	CreatedBy       string   `json:"createdBy"`
	CreatedAt       int64    `json:"createdAt"`
}

// GetCalendarEvents возвращает события календаря
func GetCalendarEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, _ = c.Get("userID")

		chatID := c.Query("chatId")

		// В реальности события должны храниться в БД
		// Здесь возвращаем пустой список как заглушку
		events := []CalendarEvent{}

		if chatID != "" {
			// Фильтруем по чату
			filtered := []CalendarEvent{}
			for _, event := range events {
				if event.ChatID == chatID {
					filtered = append(filtered, event)
				}
			}
			events = filtered
		}

		c.JSON(http.StatusOK, gin.H{"events": events})
	}
}

// CreateCalendarEvent создает новое событие
func CreateCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Title           string   `json:"title"`
			Description     string   `json:"description"`
			StartTime       int64    `json:"startTime"`
			EndTime         *int64   `json:"endTime,omitempty"`
			ChatID          string   `json:"chatId,omitempty"`
			ReminderMinutes int      `json:"reminderMinutes"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		event := CalendarEvent{
			ID:              uuid.New().String(),
			Title:           req.Title,
			Description:     req.Description,
			StartTime:       req.StartTime,
			EndTime:         req.EndTime,
			ChatID:          req.ChatID,
			ReminderMinutes: req.ReminderMinutes,
			CreatedBy:       userIDStr,
			CreatedAt:       time.Now().Unix() * 1000,
		}

		// В реальности нужно сохранить в БД

		c.JSON(http.StatusOK, gin.H{"event": event})
	}
}

// DeleteCalendarEvent удаляет событие
func DeleteCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		eventID := c.Param("id")
		userID, _ := c.Get("userID")

		// В реальности нужно удалить из БД
		_ = eventID
		_ = userID

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
