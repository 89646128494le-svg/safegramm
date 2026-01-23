package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CreateGroupCall создает запись о групповом звонке
func CreateGroupCall(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			ChatID        string   `json:"chatId" binding:"required"`
			Type          string   `json:"type" binding:"required"` // "voice" | "video"
			Status        string   `json:"status" binding:"required"` // "active" | "ended"
			StartedAt     int64    `json:"startedAt"`
			EndedAt       *int64   `json:"endedAt,omitempty"`
			ParticipantIds []string `json:"participantIds"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		startedAt := time.Unix(req.StartedAt/1000, 0)
		var endedAt *time.Time
		if req.EndedAt != nil && *req.EndedAt > 0 {
			t := time.Unix(*req.EndedAt/1000, 0)
			endedAt = &t
		}

		// Проверяем, есть ли уже активный звонок
		var existingCall models.GroupCall
		if err := db.Where("chat_id = ? AND status = ?", req.ChatID, "active").First(&existingCall).Error; err == nil {
			// Обновляем существующий
			if req.Status == "ended" {
				existingCall.Status = "ended"
				existingCall.EndedAt = endedAt
				db.Save(&existingCall)
			}
			c.JSON(http.StatusOK, gin.H{"call": existingCall})
			return
		}

		call := models.GroupCall{
			ID:        uuid.New().String(),
			ChatID:    req.ChatID,
			StartedBy: userIDStr,
			Type:      req.Type,
			Status:    req.Status,
			StartedAt: startedAt,
			EndedAt:   endedAt,
		}

		if err := db.Create(&call).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Добавляем участников
		for _, participantID := range req.ParticipantIds {
			db.Create(&models.GroupCallParticipant{
				ID:     uuid.New().String(),
				CallID: call.ID,
				UserID: participantID,
			})
		}

		// Загружаем полную информацию
		db.Preload("Starter").Preload("Participants").Preload("Participants.User").First(&call, "id = ?", call.ID)

		c.JSON(http.StatusOK, gin.H{"call": call})
	}
}

// GetGroupCallHistory возвращает историю групповых звонков
func GetGroupCallHistory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		chatID := c.Query("chatId")
		limit := 50
		if limitStr := c.Query("limit"); limitStr != "" {
			// Простой парсинг
			limit = 50
		}

		query := db.Where("started_by = ? OR EXISTS (SELECT 1 FROM group_call_participants WHERE group_call_participants.call_id = group_calls.id AND group_call_participants.user_id = ?)", 
			userIDStr, userIDStr).
			Preload("Starter").
			Preload("Participants").
			Preload("Participants.User").
			Order("started_at DESC").
			Limit(limit)

		if chatID != "" {
			query = query.Where("chat_id = ?", chatID)
		}

		var calls []models.GroupCall
		if err := query.Find(&calls).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(calls))
		for i, call := range calls {
			participantsData := make([]gin.H, len(call.Participants))
			for j, p := range call.Participants {
				var leftAtInt *int64
				if p.LeftAt != nil {
					leftAtMs := p.LeftAt.Unix() * 1000
					leftAtInt = &leftAtMs
				}
				participantsData[j] = gin.H{
					"userId":   p.UserID,
					"joinedAt": p.JoinedAt.Unix() * 1000, // Конвертируем в миллисекунды
					"leftAt":   leftAtInt,
					"duration": p.Duration,
					"user": gin.H{
						"id":       p.User.ID,
						"username": p.User.Username,
						"avatarUrl": p.User.AvatarURL,
					},
				}
			}

			var endedAtInt *int64
			if call.EndedAt != nil {
				endedAtMs := call.EndedAt.Unix() * 1000
				endedAtInt = &endedAtMs
			}

			result[i] = gin.H{
				"id":           call.ID,
				"chatId":       call.ChatID,
				"startedBy":    call.StartedBy,
				"type":         call.Type,
				"status":       call.Status,
				"startedAt":    call.StartedAt.Unix() * 1000, // Конвертируем в миллисекунды
				"endedAt":      endedAtInt,
				"recordingUrl": call.RecordingURL,
				"participants": participantsData,
				"starter": gin.H{
					"id":       call.Starter.ID,
					"username": call.Starter.Username,
					"avatarUrl": call.Starter.AvatarURL,
				},
			}
		}

		c.JSON(http.StatusOK, gin.H{"calls": result})
	}
}
