package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

var supportTicketStatuses = map[string]bool{
	"open":         true,
	"in_progress":  true,
	"waiting_user": true,
	"resolved":     true,
	"closed":       true,
}

var supportTicketCategories = map[string]bool{
	"general":  true,
	"bug":      true,
	"billing":  true,
	"security": true,
	"account":  true,
	"premium":  true,
	"idea":     true,
}

var supportTicketPriorities = map[string]bool{
	"low":      true,
	"normal":   true,
	"high":     true,
	"critical": true,
}

func normalizeSupportCategory(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	if supportTicketCategories[value] {
		return value
	}
	return "general"
}

func normalizeSupportPriority(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	if supportTicketPriorities[value] {
		return value
	}
	return "normal"
}

func normalizeSupportStatus(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	if supportTicketStatuses[value] {
		return value
	}
	return "open"
}

func supportTicketStatusLabel(status string) string {
	switch normalizeSupportStatus(status) {
	case "in_progress":
		return "В работе"
	case "waiting_user":
		return "Ждём ответ пользователя"
	case "resolved":
		return "Решено"
	case "closed":
		return "Закрыто"
	default:
		return "Открыт"
	}
}

func serializeFeedbackTicket(ticket models.Feedback, user *models.User) gin.H {
	out := gin.H{
		"id":            ticket.ID,
		"userId":        ticket.UserID,
		"subject":       ticket.Subject,
		"body":          ticket.Body,
		"category":      normalizeSupportCategory(ticket.Category),
		"priority":      normalizeSupportPriority(ticket.Priority),
		"status":        normalizeSupportStatus(ticket.Status),
		"statusLabel":   supportTicketStatusLabel(ticket.Status),
		"contactEmail":  ticket.ContactEmail,
		"chatId":        ticket.ChatID,
		"lastReplyAt":   ticket.LastReplyAt,
		"lastMessageAt": ticket.LastMessageAt,
		"resolvedAt":    ticket.ResolvedAt,
		"createdAt":     ticket.CreatedAt,
		"updatedAt":     ticket.UpdatedAt,
	}
	if user != nil {
		out["user"] = gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email": func() string {
				if user.Email != nil {
					return *user.Email
				}
				return ""
			}(),
		}
	}
	return out
}

func mapFeedbackUsers(db *gorm.DB, tickets []models.Feedback) (map[string]models.User, error) {
	userIDs := make([]string, 0, len(tickets))
	seen := make(map[string]bool, len(tickets))
	for _, ticket := range tickets {
		if ticket.UserID == "" || seen[ticket.UserID] {
			continue
		}
		seen[ticket.UserID] = true
		userIDs = append(userIDs, ticket.UserID)
	}
	if len(userIDs) == 0 {
		return map[string]models.User{}, nil
	}

	var users []models.User
	if err := db.Select("id", "username", "email").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		return nil, err
	}

	result := make(map[string]models.User, len(users))
	for _, user := range users {
		result[user.ID] = user
	}
	return result, nil
}

func GetMyFeedback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok || userIDStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var tickets []models.Feedback
		if err := db.Where("user_id = ?", userIDStr).
			Order("updated_at DESC, created_at DESC").
			Limit(100).
			Find(&tickets).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		out := make([]gin.H, 0, len(tickets))
		for _, ticket := range tickets {
			out = append(out, serializeFeedbackTicket(ticket, nil))
		}

		c.JSON(http.StatusOK, gin.H{"tickets": out})
	}
}

func PatchAdminFeedback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ticketID := strings.TrimSpace(c.Param("id"))
		if ticketID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var req struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		status := normalizeSupportStatus(req.Status)
		var ticket models.Feedback
		if err := db.First(&ticket, "id = ?", ticketID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		updates := map[string]any{
			"status": status,
		}
		now := time.Now().UTC()
		if status == "resolved" || status == "closed" {
			updates["resolved_at"] = now
		} else {
			updates["resolved_at"] = nil
		}

		if err := db.Model(&models.Feedback{}).Where("id = ?", ticket.ID).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		if err := db.First(&ticket, "id = ?", ticket.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var user models.User
		_ = db.Select("id", "username", "email").First(&user, "id = ?", ticket.UserID).Error

		c.JSON(http.StatusOK, gin.H{
			"ok":     true,
			"ticket": serializeFeedbackTicket(ticket, &user),
		})
	}
}
