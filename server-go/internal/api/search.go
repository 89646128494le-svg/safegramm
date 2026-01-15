package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// UniversalSearch универсальный поиск по сообщениям, чатам и пользователям
func UniversalSearch(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		searchType := c.Query("type") // messages, chats, users, all
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if query == "" || len(query) < 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "query_too_short"})
			return
		}

		queryLower := strings.ToLower(query)
		result := gin.H{}

		// Поиск по сообщениям
		if searchType == "" || searchType == "all" || searchType == "messages" {
			var chatMembers []models.ChatMember
			db.Where("user_id = ?", userIDStr).Find(&chatMembers)
			chatIDs := make([]string, len(chatMembers))
			for i, m := range chatMembers {
				chatIDs[i] = m.ChatID
			}

			var messages []models.Message
			if len(chatIDs) > 0 {
				db.Where("chat_id IN ? AND deleted_at IS NULL", chatIDs).
					Where("LOWER(text) LIKE ?", "%"+queryLower+"%").
					Preload("Sender").
					Preload("Chat").
					Order("created_at DESC").
					Limit(20).
					Find(&messages)
			}

			messagesData := make([]gin.H, len(messages))
			for i, msg := range messages {
				messagesData[i] = gin.H{
					"id":        msg.ID,
					"chatId":    msg.ChatID,
					"senderId":  msg.SenderID,
					"text":      msg.Text,
					"createdAt": msg.CreatedAt.Unix() * 1000,
				}
				if msg.Sender.ID != "" {
					messagesData[i]["sender"] = gin.H{
						"id":       msg.Sender.ID,
						"username": msg.Sender.Username,
						"avatarUrl": msg.Sender.AvatarURL,
					}
				}
				if msg.Chat.ID != "" {
					messagesData[i]["chat"] = gin.H{
						"id":   msg.Chat.ID,
						"name": msg.Chat.Name,
						"type": msg.Chat.Type,
					}
				}
			}
			result["messages"] = messagesData
		}

		// Поиск по чатам
		if searchType == "" || searchType == "all" || searchType == "chats" {
			var chatMembers []models.ChatMember
			db.Where("user_id = ?", userIDStr).Find(&chatMembers)
			chatIDs := make([]string, len(chatMembers))
			for i, m := range chatMembers {
				chatIDs[i] = m.ChatID
			}

			var chats []models.Chat
			if len(chatIDs) > 0 {
				db.Where("id IN ?", chatIDs).
					Where("(LOWER(name) LIKE ? OR LOWER(description) LIKE ?)", "%"+queryLower+"%", "%"+queryLower+"%").
					Preload("Members").
					Limit(20).
					Find(&chats)
			}

			chatsData := make([]gin.H, len(chats))
			for i, chat := range chats {
				chatsData[i] = gin.H{
					"id":          chat.ID,
					"type":        chat.Type,
					"name":        chat.Name,
					"description": chat.Description,
					"createdAt":   chat.CreatedAt.Unix() * 1000,
				}
			}
			result["chats"] = chatsData
		}

		// Поиск по пользователям
		if searchType == "" || searchType == "all" || searchType == "users" {
			var users []models.User
			db.Where("LOWER(username) LIKE ?", "%"+queryLower+"%").
				Where("id != ?", userIDStr).
				Limit(20).
				Find(&users)

			usersData := make([]gin.H, len(users))
			for i, user := range users {
				usersData[i] = gin.H{
					"id":        user.ID,
					"username":  user.Username,
					"avatarUrl": user.AvatarURL,
					"status":    user.Status,
					"plan":      user.Plan,
				}
			}
			result["users"] = usersData
		}

		c.JSON(http.StatusOK, result)
	}
}

// SearchMessages ищет сообщения по тексту (старый endpoint для совместимости)
func SearchMessages(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Query("chatId")
		query := c.Query("q")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Если указан chatId, проверяем доступ
		if chatID != "" {
			var member models.ChatMember
			if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
				return
			}
		}

		var messages []models.Message
		queryBuilder := db.Where("deleted_at IS NULL").
			Where("LOWER(text) LIKE ?", "%"+strings.ToLower(query)+"%")

		if chatID != "" {
			queryBuilder = queryBuilder.Where("chat_id = ?", chatID)
		}

		// Ограничиваем поиск чатами пользователя
		var chatMembers []models.ChatMember
		db.Where("user_id = ?", userIDStr).Find(&chatMembers)
		chatIDs := make([]string, len(chatMembers))
		for i, m := range chatMembers {
			chatIDs[i] = m.ChatID
		}

		if len(chatIDs) > 0 {
			queryBuilder = queryBuilder.Where("chat_id IN ?", chatIDs)
		}

		queryBuilder.Preload("Sender").
			Preload("Chat").
			Order("created_at DESC").
			Limit(50).
			Find(&messages)

		c.JSON(http.StatusOK, gin.H{"messages": messages})
	}
}

