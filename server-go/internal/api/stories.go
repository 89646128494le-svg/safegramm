package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CreateStory создает новую историю
func CreateStory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Type           string `json:"type" binding:"required"` // image, video, text
			ContentURL     string `json:"contentUrl,omitempty"`
			Text           string `json:"text,omitempty"`
			BackgroundColor string `json:"backgroundColor,omitempty"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Создаем историю с временем жизни 24 часа
		story := models.Story{
			ID:            uuid.New().String(),
			UserID:        userIDStr,
			Type:          req.Type,
			ContentURL:    req.ContentURL,
			Text:          req.Text,
			BackgroundColor: req.BackgroundColor,
			ExpiresAt:     time.Now().Add(24 * time.Hour),
		}

		if err := db.Create(&story).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем с пользователем
		db.Preload("User").First(&story, "id = ?", story.ID)

		response := gin.H{
			"id":            story.ID,
			"userId":        story.UserID,
			"type":          story.Type,
			"contentUrl":    story.ContentURL,
			"text":          story.Text,
			"backgroundColor": story.BackgroundColor,
			"expiresAt":     story.ExpiresAt.Unix() * 1000,
			"createdAt":     story.CreatedAt.Unix() * 1000,
		}

		if story.User.ID != "" {
			response["user"] = gin.H{
				"id":       story.User.ID,
				"username": story.User.Username,
				"avatarUrl": story.User.AvatarURL,
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetStories возвращает активные истории пользователей
func GetStories(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Получаем истории от пользователей, на которых подписан текущий пользователь
		// Для упрощения показываем все активные истории
		var stories []models.Story
		if err := db.Where("expires_at > ?", time.Now()).
			Preload("User").
			Preload("Views", "user_id = ?", userIDStr). // Загружаем только просмотры текущего пользователя
			Order("created_at DESC").
			Find(&stories).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Группируем по пользователям
		storiesByUser := make(map[string][]gin.H)
		for _, story := range stories {
			if story.User.ID == "" {
				continue
			}

			storyData := gin.H{
				"id":            story.ID,
				"type":          story.Type,
				"contentUrl":    story.ContentURL,
				"text":          story.Text,
				"backgroundColor": story.BackgroundColor,
				"expiresAt":     story.ExpiresAt.Unix() * 1000,
				"createdAt":     story.CreatedAt.Unix() * 1000,
				"viewed":        len(story.Views) > 0, // Просмотрена ли текущим пользователем
			}

			userId := story.UserID
			if _, exists := storiesByUser[userId]; !exists {
				storiesByUser[userId] = []gin.H{}
			}
			storiesByUser[userId] = append(storiesByUser[userId], storyData)
		}

		// Формируем ответ
		result := make([]gin.H, 0, len(storiesByUser))
		for userId, userStories := range storiesByUser {
			// Находим информацию о пользователе из первой истории
			var userInfo gin.H
			for _, story := range stories {
				if story.UserID == userId && story.User.ID != "" {
					userInfo = gin.H{
						"id":       story.User.ID,
						"username": story.User.Username,
						"avatarUrl": story.User.AvatarURL,
					}
					break
				}
			}

			result = append(result, gin.H{
				"user":    userInfo,
				"stories": userStories,
			})
		}

		c.JSON(http.StatusOK, gin.H{"stories": result})
	}
}

// ViewStory отмечает историю как просмотренную
func ViewStory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		storyID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем существование истории
		var story models.Story
		if err := db.First(&story, "id = ?", storyID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, не просмотрена ли уже
		var existing models.StoryView
		if err := db.Where("story_id = ? AND user_id = ?", storyID, userIDStr).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"ok": true, "alreadyViewed": true})
			return
		}

		// Создаем просмотр
		view := models.StoryView{
			ID:      uuid.New().String(),
			StoryID: storyID,
			UserID:  userIDStr,
		}

		if err := db.Create(&view).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeleteStory удаляет историю
func DeleteStory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		storyID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, что история принадлежит пользователю
		var story models.Story
		if err := db.First(&story, "id = ?", storyID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		if story.UserID != userIDStr {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Удаляем просмотры и саму историю
		db.Where("story_id = ?", storyID).Delete(&models.StoryView{})
		db.Delete(&story)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

