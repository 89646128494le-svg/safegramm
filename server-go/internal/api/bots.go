package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Bot представляет бота
type Bot struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Username    string   `json:"username"`
	Description string   `json:"description,omitempty"`
	Commands    []string `json:"commands,omitempty"`
	IsActive    bool     `json:"isActive"`
	ChatID      string   `json:"chatId,omitempty"`
	CreatedBy   string   `json:"createdBy"`
	CreatedAt   int64    `json:"createdAt"`
}

// GetBots возвращает список ботов
func GetBots(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, _ = c.Get("userID")

		chatID := c.Query("chatId")

		// В реальности боты должны храниться в БД
		// Здесь возвращаем пустой список как заглушку
		bots := []Bot{}

		if chatID != "" {
			// Фильтруем по чату
			filtered := []Bot{}
			for _, bot := range bots {
				if bot.ChatID == chatID {
					filtered = append(filtered, bot)
				}
			}
			bots = filtered
		}

		c.JSON(http.StatusOK, gin.H{"bots": bots})
	}
}

// CreateBot создает нового бота
func CreateBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		_, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Name        string   `json:"name"`
			Username    string   `json:"username"`
			Description string   `json:"description"`
			Commands    []string `json:"commands"`
			ChatID      string   `json:"chatId"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// В реальности нужно сохранить в БД
		userIDStr, _ := userID.(string)
		bot := Bot{
			ID:          uuid.New().String(),
			Name:        req.Name,
			Username:    req.Username,
			Description: req.Description,
			Commands:    req.Commands,
			IsActive:    true,
			ChatID:      req.ChatID,
			CreatedBy:   userIDStr,
			CreatedAt:   time.Now().Unix() * 1000,
		}

		c.JSON(http.StatusOK, gin.H{"bot": bot})
	}
}

// ToggleBot активирует/деактивирует бота
func ToggleBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		botID := c.Param("id")
		userID, _ := c.Get("userID")

		var req struct {
			IsActive bool `json:"isActive"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// В реальности нужно обновить в БД
		_ = botID
		_ = userID

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeleteBot удаляет бота
func DeleteBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		botID := c.Param("id")
		userID, _ := c.Get("userID")

		// В реальности нужно удалить из БД
		_ = botID
		_ = userID

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
