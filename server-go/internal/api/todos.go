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

type todoResponse struct {
	ID         string `json:"id"`
	Text       string `json:"text"`
	Completed  bool   `json:"completed"`
	ChatID     string `json:"chatId,omitempty"`
	AssignedTo string `json:"assignedTo,omitempty"`
	DueDate    *int64 `json:"dueDate,omitempty"`
	Priority   string `json:"priority,omitempty"`
	CreatedBy  string `json:"createdBy"`
	CreatedAt  int64  `json:"createdAt"`
}

func serializeTodo(todo models.Todo) todoResponse {
	var dueDate *int64
	if todo.DueDate != nil {
		value := todo.DueDate.UnixMilli()
		dueDate = &value
	}

	return todoResponse{
		ID:         todo.ID,
		Text:       todo.Text,
		Completed:  todo.Completed,
		ChatID:     todo.ChatID,
		AssignedTo: todo.AssignedTo,
		DueDate:    dueDate,
		Priority:   todo.Priority,
		CreatedBy:  todo.CreatedBy,
		CreatedAt:  todo.CreatedAt.UnixMilli(),
	}
}

func normalizeTodoPriority(priority string) string {
	switch strings.ToLower(strings.TrimSpace(priority)) {
	case "low", "medium", "high":
		return strings.ToLower(strings.TrimSpace(priority))
	default:
		return "medium"
	}
}

func GetTodos(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := requireUserID(c)
		if !ok {
			return
		}

		chatID := strings.TrimSpace(c.Query("chatId"))
		query := db.Model(&models.Todo{})

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

		var todos []models.Todo
		if err := query.Order("completed ASC").Order("created_at DESC").Find(&todos).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		response := make([]todoResponse, 0, len(todos))
		for _, todo := range todos {
			response = append(response, serializeTodo(todo))
		}

		c.JSON(http.StatusOK, gin.H{"todos": response})
	}
}

func CreateTodo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := requireUserID(c)
		if !ok {
			return
		}

		var req struct {
			Text     string `json:"text"`
			ChatID   string `json:"chatId,omitempty"`
			Priority string `json:"priority"`
			DueDate  *int64 `json:"dueDate,omitempty"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		text := strings.TrimSpace(req.Text)
		chatID := strings.TrimSpace(req.ChatID)
		if text == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
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

		var dueDate *time.Time
		if req.DueDate != nil && *req.DueDate > 0 {
			value := time.UnixMilli(*req.DueDate).UTC()
			dueDate = &value
		}

		todo := models.Todo{
			ID:        uuid.New().String(),
			Text:      text,
			Completed: false,
			ChatID:    chatID,
			DueDate:   dueDate,
			Priority:  normalizeTodoPriority(req.Priority),
			CreatedBy: userID,
		}

		if err := db.Create(&todo).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"todo": serializeTodo(todo)})
	}
}

func UpdateTodo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := requireUserID(c)
		if !ok {
			return
		}

		var req struct {
			Completed *bool  `json:"completed,omitempty"`
			Text      string `json:"text,omitempty"`
			Priority  string `json:"priority,omitempty"`
			DueDate   *int64 `json:"dueDate,omitempty"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var todo models.Todo
		if err := db.First(&todo, "id = ?", c.Param("id")).Error; err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = http.StatusNotFound
			}
			c.JSON(status, gin.H{"error": "not_found"})
			return
		}

		if todo.ChatID != "" {
			if err := ensureChatMember(db, todo.ChatID, userID); err != nil {
				status := http.StatusInternalServerError
				if errors.Is(err, gorm.ErrRecordNotFound) {
					status = http.StatusForbidden
				}
				c.JSON(status, gin.H{"error": "forbidden"})
				return
			}
		} else if todo.CreatedBy != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		updates := map[string]any{}
		if req.Completed != nil {
			updates["completed"] = *req.Completed
		}
		if text := strings.TrimSpace(req.Text); text != "" {
			updates["text"] = text
		}
		if strings.TrimSpace(req.Priority) != "" {
			updates["priority"] = normalizeTodoPriority(req.Priority)
		}
		if req.DueDate != nil {
			if *req.DueDate <= 0 {
				updates["due_date"] = nil
			} else {
				updates["due_date"] = time.UnixMilli(*req.DueDate).UTC()
			}
		}
		if len(updates) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if err := db.Model(&todo).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		if err := db.First(&todo, "id = ?", todo.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "todo": serializeTodo(todo)})
	}
}

func DeleteTodo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := requireUserID(c)
		if !ok {
			return
		}

		var todo models.Todo
		if err := db.First(&todo, "id = ?", c.Param("id")).Error; err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = http.StatusNotFound
			}
			c.JSON(status, gin.H{"error": "not_found"})
			return
		}

		if todo.ChatID != "" {
			if err := ensureChatMember(db, todo.ChatID, userID); err != nil {
				status := http.StatusInternalServerError
				if errors.Is(err, gorm.ErrRecordNotFound) {
					status = http.StatusForbidden
				}
				c.JSON(status, gin.H{"error": "forbidden"})
				return
			}
		} else if todo.CreatedBy != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if err := db.Delete(&todo).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
