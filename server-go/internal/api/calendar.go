package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

type calendarEventResponse struct {
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

func serializeCalendarEvent(event models.CalendarEvent) calendarEventResponse {
	var endTime *int64
	if event.EndTime != nil {
		value := event.EndTime.UnixMilli()
		endTime = &value
	}

	return calendarEventResponse{
		ID:              event.ID,
		Title:           event.Title,
		Description:     event.Description,
		StartTime:       event.StartTime.UnixMilli(),
		EndTime:         endTime,
		ChatID:          event.ChatID,
		ReminderMinutes: event.ReminderMinutes,
		CreatedBy:       event.CreatedBy,
		CreatedAt:       event.CreatedAt.UnixMilli(),
	}
}

func requireUserID(c *gin.Context) (string, bool) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	userIDStr, ok := userID.(string)
	if !ok || strings.TrimSpace(userIDStr) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	return userIDStr, true
}

func ensureChatMember(db *gorm.DB, chatID, userID string) error {
	var member models.ChatMember
	return db.Select("id").Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member).Error
}

func listAccessibleChatIDs(db *gorm.DB, userID string) ([]string, error) {
	var chatIDs []string
	if err := db.Model(&models.ChatMember{}).Where("user_id = ?", userID).Pluck("chat_id", &chatIDs).Error; err != nil {
		return nil, err
	}
	return chatIDs, nil
}

func GetCalendarEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := requireUserID(c)
		if !ok {
			return
		}

		chatID := strings.TrimSpace(c.Query("chatId"))
		query := db.Model(&models.CalendarEvent{})

		if chatID != "" {
			if err := ensureChatMember(db, chatID, userID); err != nil {
				status := http.StatusInternalServerError
				if errors.Is(err, gorm.ErrRecordNotFound) {
					status = http.StatusForbidden
				}
				c.JSON(status, gin.H{"error": "forbidden"})
				return
			}
			query = query.Where("chat_id = ?", chatID)
		} else {
			chatIDs, err := listAccessibleChatIDs(db, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
				return
			}
			query = query.Where("created_by = ? AND (chat_id = '' OR chat_id IS NULL)", userID)
			if len(chatIDs) > 0 {
				query = query.Or("chat_id IN ?", chatIDs)
			}
		}

		var events []models.CalendarEvent
		if err := query.Order("start_time ASC").Order("created_at DESC").Find(&events).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		response := make([]calendarEventResponse, 0, len(events))
		for _, event := range events {
			response = append(response, serializeCalendarEvent(event))
		}

		c.JSON(http.StatusOK, gin.H{"events": response})
	}
}

func CreateCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := requireUserID(c)
		if !ok {
			return
		}

		var req struct {
			Title           string `json:"title"`
			Description     string `json:"description"`
			StartTime       int64  `json:"startTime"`
			EndTime         *int64 `json:"endTime,omitempty"`
			ChatID          string `json:"chatId,omitempty"`
			ReminderMinutes int    `json:"reminderMinutes"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		title := strings.TrimSpace(req.Title)
		chatID := strings.TrimSpace(req.ChatID)
		if title == "" || req.StartTime <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if req.EndTime != nil && *req.EndTime < req.StartTime {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "end_before_start"})
			return
		}
		if chatID != "" {
			if err := ensureChatMember(db, chatID, userID); err != nil {
				status := http.StatusInternalServerError
				if errors.Is(err, gorm.ErrRecordNotFound) {
					status = http.StatusForbidden
				}
				c.JSON(status, gin.H{"error": "forbidden"})
				return
			}
		}

		startTime := time.UnixMilli(req.StartTime).UTC()
		var endTime *time.Time
		if req.EndTime != nil {
			value := time.UnixMilli(*req.EndTime).UTC()
			endTime = &value
		}
		reminderMinutes := req.ReminderMinutes
		if reminderMinutes < 0 {
			reminderMinutes = 0
		}

		event := models.CalendarEvent{
			ID:              uuid.New().String(),
			Title:           title,
			Description:     strings.TrimSpace(req.Description),
			StartTime:       startTime,
			EndTime:         endTime,
			ChatID:          chatID,
			ReminderMinutes: reminderMinutes,
			CreatedBy:       userID,
		}

		if err := db.Create(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"event": serializeCalendarEvent(event)})
	}
}

func DeleteCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := requireUserID(c)
		if !ok {
			return
		}

		eventID := c.Param("id")
		var event models.CalendarEvent
		if err := db.First(&event, "id = ?", eventID).Error; err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = http.StatusNotFound
			}
			c.JSON(status, gin.H{"error": "not_found"})
			return
		}

		if event.ChatID != "" {
			if err := ensureChatMember(db, event.ChatID, userID); err != nil {
				status := http.StatusInternalServerError
				if errors.Is(err, gorm.ErrRecordNotFound) {
					status = http.StatusForbidden
				}
				c.JSON(status, gin.H{"error": "forbidden"})
				return
			}
		} else if event.CreatedBy != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if err := db.Delete(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
