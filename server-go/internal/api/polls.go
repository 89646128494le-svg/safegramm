package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/websocket"
)

// CreatePoll создает опрос в сообщении
func CreatePoll(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Question   string                `json:"question" binding:"required"`
			Options    []models.PollOption   `json:"options" binding:"required,min=2,max=10"`
			AllowsMulti bool                 `json:"allowsMulti"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Проверяем существование сообщения и что пользователь является отправителем
		var message models.Message
		if err := db.First(&message, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		if message.SenderID != userIDStr {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Проверяем, нет ли уже опроса для этого сообщения
		var existing models.Poll
		if err := db.Where("message_id = ?", messageID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "poll_already_exists"})
			return
		}

		// Создаем опрос
		poll := models.Poll{
			ID:         uuid.New().String(),
			MessageID:  messageID,
			Question:   req.Question,
			AllowsMulti: req.AllowsMulti,
		}

		if err := poll.SetOptions(req.Options); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if err := db.Create(&poll).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем опрос с голосами
		db.Preload("Votes").Preload("Votes.User").First(&poll, "id = ?", poll.ID)

		// Формируем ответ
		options, _ := poll.GetOptions()
		response := gin.H{
			"id":         poll.ID,
			"messageId":  poll.MessageID,
			"question":   poll.Question,
			"options":    options,
			"allowsMulti": poll.AllowsMulti,
			"createdAt":  poll.CreatedAt.Unix() * 1000,
			"votes":      make([]gin.H, len(poll.Votes)),
		}

		for i, vote := range poll.Votes {
			response["votes"].([]gin.H)[i] = gin.H{
				"id":       vote.ID,
				"userId":   vote.UserID,
				"optionId": vote.OptionID,
				"createdAt": vote.CreatedAt.Unix() * 1000,
			}
			if vote.User.ID != "" {
				response["votes"].([]gin.H)[i]["user"] = gin.H{
					"id":       vote.User.ID,
					"username": vote.User.Username,
					"avatarUrl": vote.User.AvatarURL,
				}
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

// VotePoll голосует в опросе
func VotePoll(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		pollID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			OptionID string `json:"optionId" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Проверяем существование опроса
		var poll models.Poll
		if err := db.Preload("Message").First(&poll, "id = ?", pollID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что опция существует
		options, _ := poll.GetOptions()
		optionExists := false
		for _, opt := range options {
			if opt.ID == req.OptionID {
				optionExists = true
				break
			}
		}

		if !optionExists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_option"})
			return
		}

		// Проверяем существующий голос
		var existingVote models.PollVote
		if err := db.Where("poll_id = ? AND user_id = ?", pollID, userIDStr).First(&existingVote).Error; err == nil {
			if poll.AllowsMulti {
				// Для множественного выбора проверяем, не голосовал ли уже за эту опцию
				if existingVote.OptionID == req.OptionID {
					c.JSON(http.StatusConflict, gin.H{"error": "already_voted"})
					return
				}
				// Создаем новый голос
			} else {
				// Для одиночного выбора обновляем голос
				existingVote.OptionID = req.OptionID
				if err := db.Save(&existingVote).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
					return
				}
				c.JSON(http.StatusOK, gin.H{"ok": true, "voteId": existingVote.ID})
				return
			}
		}

		// Создаем новый голос
		vote := models.PollVote{
			ID:       uuid.New().String(),
			PollID:   pollID,
			UserID:   userIDStr,
			OptionID: req.OptionID,
		}

		if err := db.Create(&vote).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем обновленный опрос
		db.Preload("Votes").Preload("Votes.User").First(&poll, "id = ?", pollID)

		// Формируем ответ
		options, _ = poll.GetOptions()
		response := gin.H{
			"id":         poll.ID,
			"messageId":  poll.MessageID,
			"question":   poll.Question,
			"options":    options,
			"allowsMulti": poll.AllowsMulti,
			"createdAt":  poll.CreatedAt.Unix() * 1000,
			"votes":      make([]gin.H, len(poll.Votes)),
		}

		for i, v := range poll.Votes {
			response["votes"].([]gin.H)[i] = gin.H{
				"id":       v.ID,
				"userId":   v.UserID,
				"optionId": v.OptionID,
				"createdAt": v.CreatedAt.Unix() * 1000,
			}
			if v.User.ID != "" {
				response["votes"].([]gin.H)[i]["user"] = gin.H{
					"id":       v.User.ID,
					"username": v.User.Username,
					"avatarUrl": v.User.AvatarURL,
				}
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetPoll возвращает информацию об опросе
func GetPoll(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		pollID := c.Param("id")

		var poll models.Poll
		if err := db.Preload("Votes").Preload("Votes.User").First(&poll, "id = ?", pollID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		options, _ := poll.GetOptions()
		response := gin.H{
			"id":         poll.ID,
			"messageId":  poll.MessageID,
			"question":   poll.Question,
			"options":    options,
			"allowsMulti": poll.AllowsMulti,
			"createdAt":  poll.CreatedAt.Unix() * 1000,
			"votes":      make([]gin.H, len(poll.Votes)),
		}

		for i, vote := range poll.Votes {
			response["votes"].([]gin.H)[i] = gin.H{
				"id":       vote.ID,
				"userId":   vote.UserID,
				"optionId": vote.OptionID,
				"createdAt": vote.CreatedAt.Unix() * 1000,
			}
			if vote.User.ID != "" {
				response["votes"].([]gin.H)[i]["user"] = gin.H{
					"id":       vote.User.ID,
					"username": vote.User.Username,
					"avatarUrl": vote.User.AvatarURL,
				}
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

