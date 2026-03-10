package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// ExportChat экспортирует историю чата (требует премиум)
func ExportChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем премиум статус
		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		state, err := syncUserPremiumState(db, &user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if !state.IsPremium {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "premium_required",
				"message": "Экспорт истории доступен только для Premium пользователей",
			})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		format := c.Query("format") // json, txt
		if format == "" {
			format = "json"
		}

		// Загружаем чат
		var chat models.Chat
		if err := db.First(&chat, "id = ?", chatID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Загружаем все сообщения
		var messages []models.Message
		if err := db.Where("chat_id = ? AND deleted_at IS NULL", chatID).
			Preload("Sender").
			Preload("Reactions").
			Order("created_at ASC").
			Find(&messages).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if format == "txt" {
			// Экспорт в текстовый формат
			var sb strings.Builder
			sb.WriteString("=== Экспорт чата ===\n")
			sb.WriteString("Чат: " + chat.Name + "\n")
			sb.WriteString("Тип: " + chat.Type + "\n")
			sb.WriteString("Дата экспорта: " + time.Now().Format("2006-01-02 15:04:05") + "\n")
			sb.WriteString("\n=== Сообщения ===\n\n")

			for _, msg := range messages {
				senderName := "Неизвестный"
				if msg.Sender.ID != "" {
					senderName = msg.Sender.Username
				}

				timestamp := msg.CreatedAt.Format("2006-01-02 15:04:05")
				sb.WriteString("[" + timestamp + "] " + senderName + ":\n")

				if msg.Text != "" {
					sb.WriteString(msg.Text + "\n")
				}

				if msg.AttachmentURL != "" {
					sb.WriteString("📎 Вложение: " + msg.AttachmentURL + "\n")
				}

				if len(msg.Reactions) > 0 {
					reactions := make(map[string]int)
					for _, r := range msg.Reactions {
						reactions[r.Emoji]++
					}
					var reactionStrs []string
					for emoji, count := range reactions {
						reactionStrs = append(reactionStrs, emoji+" "+string(rune(count+'0')))
					}
					sb.WriteString("Реакции: " + strings.Join(reactionStrs, ", ") + "\n")
				}

				sb.WriteString("\n")
			}

			c.Header("Content-Type", "text/plain; charset=utf-8")
			c.Header("Content-Disposition", `attachment; filename="chat_`+chatID+`_`+time.Now().Format("20060102")+`.txt"`)
			c.String(http.StatusOK, sb.String())
			return
		}

		// Экспорт в JSON
		exportData := gin.H{
			"chat": gin.H{
				"id":          chat.ID,
				"type":        chat.Type,
				"name":        chat.Name,
				"description": chat.Description,
				"createdAt":   chat.CreatedAt.Unix() * 1000,
			},
			"exportedAt":   time.Now().Unix() * 1000,
			"messageCount": len(messages),
			"messages":     make([]gin.H, len(messages)),
		}

		for i, msg := range messages {
			msgData := gin.H{
				"id":        msg.ID,
				"senderId":  msg.SenderID,
				"text":      msg.Text,
				"createdAt": msg.CreatedAt.Unix() * 1000,
			}

			if msg.Sender.ID != "" {
				msgData["sender"] = gin.H{
					"id":        msg.Sender.ID,
					"username":  msg.Sender.Username,
					"avatarUrl": msg.Sender.AvatarURL,
				}
			}

			if msg.AttachmentURL != "" {
				msgData["attachmentUrl"] = msg.AttachmentURL
			}

			if msg.ReplyTo != "" {
				msgData["replyTo"] = msg.ReplyTo
			}

			if msg.ForwardFrom != "" {
				msgData["forwardFrom"] = msg.ForwardFrom
			}

			if msg.EditedAt != nil {
				msgData["editedAt"] = msg.EditedAt.Unix() * 1000
			}

			if len(msg.Reactions) > 0 {
				reactions := make([]gin.H, len(msg.Reactions))
				for j, r := range msg.Reactions {
					reactions[j] = gin.H{
						"emoji":     r.Emoji,
						"userId":    r.UserID,
						"createdAt": r.CreatedAt.Unix() * 1000,
					}
				}
				msgData["reactions"] = reactions
			}

			exportData["messages"].([]gin.H)[i] = msgData
		}

		jsonData, err := json.MarshalIndent(exportData, "", "  ")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.Header("Content-Type", "application/json; charset=utf-8")
		c.Header("Content-Disposition", `attachment; filename="chat_`+chatID+`_`+time.Now().Format("20060102")+`.json"`)
		c.Data(http.StatusOK, "application/json", jsonData)
	}
}
