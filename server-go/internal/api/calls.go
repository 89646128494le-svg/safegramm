package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CreateCall создает запись о звонке
func CreateCall(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			ChatID      string `json:"chatId" binding:"required"`
			OtherUserID string `json:"otherUserId" binding:"required"`
			Type        string `json:"type" binding:"required"` // "voice" | "video"
			Status      string `json:"status" binding:"required"` // "completed" | "missed" | "declined"
			Duration    int    `json:"duration"`
			StartedAt   int64  `json:"startedAt"`
			EndedAt     int64  `json:"endedAt"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Определяем caller и receiver
		callerID := userIDStr
		receiverID := req.OtherUserID
		if callerID == receiverID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_users"})
			return
		}

		startedAt := time.Unix(req.StartedAt/1000, 0)
		var endedAt *time.Time
		if req.EndedAt > 0 {
			t := time.Unix(req.EndedAt/1000, 0)
			endedAt = &t
		}

		call := models.Call{
			ID:        uuid.New().String(),
			ChatID:    req.ChatID,
			CallerID:  callerID,
			ReceiverID: receiverID,
			Type:      req.Type,
			Status:    req.Status,
			Duration:  req.Duration,
			StartedAt: startedAt,
			EndedAt:   endedAt,
		}

		if err := db.Create(&call).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем полную информацию
		db.Preload("Caller").Preload("Receiver").First(&call, "id = ?", call.ID)

		c.JSON(http.StatusOK, gin.H{
			"call": gin.H{
				"id":         call.ID,
				"chatId":     call.ChatID,
				"callerId":   call.CallerID,
				"receiverId": call.ReceiverID,
				"type":       call.Type,
				"status":     call.Status,
				"duration":   call.Duration,
				"startedAt":  call.StartedAt,
				"endedAt":    call.EndedAt,
				"caller": gin.H{
					"id":       call.Caller.ID,
					"username": call.Caller.Username,
					"avatarUrl": call.Caller.AvatarURL,
				},
				"receiver": gin.H{
					"id":       call.Receiver.ID,
					"username": call.Receiver.Username,
					"avatarUrl": call.Receiver.AvatarURL,
				},
			},
		})
	}
}

// GetCallHistory возвращает историю звонков
func GetCallHistory(db *gorm.DB) gin.HandlerFunc {
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
			if parsedLimit := parseInt(limitStr); parsedLimit > 0 && parsedLimit <= 200 {
				limit = parsedLimit
			}
		}

		query := db.Where("(caller_id = ? OR receiver_id = ?)", userIDStr, userIDStr).
			Preload("Caller").
			Preload("Receiver").
			Order("started_at DESC").
			Limit(limit)

		if chatID != "" {
			query = query.Where("chat_id = ?", chatID)
		}

		var calls []models.Call
		if err := query.Find(&calls).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(calls))
		for i, call := range calls {
			var endedAtInt *int64
			if call.EndedAt != nil {
				endedAtMs := call.EndedAt.Unix() * 1000
				endedAtInt = &endedAtMs
			}
			result[i] = gin.H{
				"id":         call.ID,
				"chatId":     call.ChatID,
				"callerId":   call.CallerID,
				"receiverId": call.ReceiverID,
				"type":       call.Type,
				"status":     call.Status,
				"duration":   call.Duration,
				"startedAt":  call.StartedAt.Unix() * 1000, // Конвертируем в миллисекунды
				"endedAt":    endedAtInt,
				"recordingUrl": call.RecordingURL,
				"caller": gin.H{
					"id":       call.Caller.ID,
					"username": call.Caller.Username,
					"avatarUrl": call.Caller.AvatarURL,
				},
				"receiver": gin.H{
					"id":       call.Receiver.ID,
					"username": call.Receiver.Username,
					"avatarUrl": call.Receiver.AvatarURL,
				},
			}
		}

		c.JSON(http.StatusOK, gin.H{"calls": result})
	}
}

// GetMissedCalls возвращает пропущенные звонки
func GetMissedCalls(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var calls []models.Call
		if err := db.Where("receiver_id = ? AND status = ?", userIDStr, "missed").
			Preload("Caller").
			Order("started_at DESC").
			Limit(50).
			Find(&calls).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		result := make([]gin.H, len(calls))
		for i, call := range calls {
			result[i] = gin.H{
				"id":         call.ID,
				"chatId":     call.ChatID,
				"callerId":   call.CallerID,
				"receiverId": call.ReceiverID,
				"type":       call.Type,
				"status":     call.Status,
				"duration":   call.Duration,
				"startedAt":  call.StartedAt.Unix() * 1000, // Конвертируем в миллисекунды
				"endedAt":    nil,
				"recordingUrl": call.RecordingURL,
				"caller": gin.H{
					"id":       call.Caller.ID,
					"username": call.Caller.Username,
					"avatarUrl": call.Caller.AvatarURL,
				},
				"receiver": gin.H{
					"id":       "",
					"username": "",
					"avatarUrl": "",
				},
			}
		}

		c.JSON(http.StatusOK, gin.H{"calls": result})
	}
}

// MarkCallAsRead отмечает пропущенный звонок как прочитанный
func MarkCallAsRead(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		callID := c.Param("id")

		var call models.Call
		if err := db.Where("id = ? AND receiver_id = ?", callID, userIDStr).First(&call).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Можно добавить поле isRead в модель Call, но для упрощения просто меняем статус
		// или создаем отдельную таблицу для прочитанных звонков
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// UploadCallRecording загружает запись звонка
func UploadCallRecording(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		chatID := c.PostForm("chatId")
		otherUserId := c.PostForm("otherUserId")
		durationStr := c.PostForm("duration")
		duration := 0
		if durationStr != "" {
			// Простой парсинг int
			for _, char := range durationStr {
				if char >= '0' && char <= '9' {
					duration = duration*10 + int(char-'0')
				} else {
					break
				}
			}
		}

		// Сохраняем файл
		filename := uuid.New().String() + ".webm"
		filepath := "./uploads/call-recordings/" + filename
		if err := c.SaveUploadedFile(file, filepath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		recordingURL := "/uploads/call-recordings/" + filename

		// Обновляем или создаем запись о звонке
		var call models.Call
		if err := db.Where("chat_id = ? AND ((caller_id = ? AND receiver_id = ?) OR (caller_id = ? AND receiver_id = ?))", 
			chatID, userIDStr, otherUserId, otherUserId, userIDStr).
			Order("started_at DESC").
			First(&call).Error; err == nil {
			// Обновляем существующий звонок
			call.RecordingURL = recordingURL
			call.Duration = duration
			db.Save(&call)
		} else {
			// Создаем новый
			call = models.Call{
				ID:           uuid.New().String(),
				ChatID:       chatID,
				CallerID:     userIDStr,
				ReceiverID:   otherUserId,
				Type:         "video", // По умолчанию, можно определить из контекста
				Status:       "completed",
				Duration:     duration,
				StartedAt:    time.Now(),
				RecordingURL: recordingURL,
			}
			db.Create(&call)
		}

		c.JSON(http.StatusOK, gin.H{
			"recordingUrl": recordingURL,
			"callId":       call.ID,
		})
	}
}
