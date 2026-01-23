package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Todo представляет задачу
type Todo struct {
	ID         string  `json:"id"`
	Text       string  `json:"text"`
	Completed  bool    `json:"completed"`
	ChatID     string  `json:"chatId,omitempty"`
	AssignedTo string  `json:"assignedTo,omitempty"`
	DueDate    *int64  `json:"dueDate,omitempty"`
	Priority   string  `json:"priority,omitempty"` // low, medium, high
	CreatedBy  string  `json:"createdBy"`
	CreatedAt  int64   `json:"createdAt"`
}

// GetTodos возвращает список задач
func GetTodos(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, _ = c.Get("userID")

		chatID := c.Query("chatId")

		// В реальности задачи должны храниться в БД
		// Здесь возвращаем пустой список как заглушку
		todos := []Todo{}

		if chatID != "" {
			// Фильтруем по чату
			filtered := []Todo{}
			for _, todo := range todos {
				if todo.ChatID == chatID {
					filtered = append(filtered, todo)
				}
			}
			todos = filtered
		}

		c.JSON(http.StatusOK, gin.H{"todos": todos})
	}
}

// CreateTodo создает новую задачу
func CreateTodo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Text     string `json:"text"`
			ChatID   string `json:"chatId,omitempty"`
			Priority string `json:"priority"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		todo := Todo{
			ID:        uuid.New().String(),
			Text:      req.Text,
			Completed: false,
			ChatID:    req.ChatID,
			Priority:  req.Priority,
			CreatedBy: userIDStr,
			CreatedAt: time.Now().Unix() * 1000,
		}

		// В реальности нужно сохранить в БД

		c.JSON(http.StatusOK, gin.H{"todo": todo})
	}
}

// UpdateTodo обновляет задачу
func UpdateTodo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		todoID := c.Param("id")
		userID, _ := c.Get("userID")

		var req struct {
			Completed bool   `json:"completed"`
			Text      string `json:"text,omitempty"`
			Priority  string `json:"priority,omitempty"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// В реальности нужно обновить в БД
		_ = todoID
		_ = userID

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeleteTodo удаляет задачу
func DeleteTodo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		todoID := c.Param("id")
		userID, _ := c.Get("userID")

		// В реальности нужно удалить из БД
		_ = todoID
		_ = userID

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
