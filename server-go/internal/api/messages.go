package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/websocket"
)

// CreateMessage создает новое сообщение
func CreateMessage(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			ChatID        string  `json:"chatId"`
			Text          string  `json:"text"`
			AttachmentURL string  `json:"attachmentUrl"`
			ReplyTo       string  `json:"replyTo"`
			ForwardFrom   string  `json:"forwardFrom"` // ID сообщения для пересылки
			StickerID     string  `json:"stickerId"`
			GifURL        string  `json:"gifUrl"`
			LocationLat   *float64 `json:"locationLat"`
			LocationLon   *float64 `json:"locationLon"`
			ThreadID      string  `json:"threadId"`
		}

		// Если chatId не в теле запроса, берем из URL параметра
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		
		// Если chatId в URL, используем его
		if chatIDFromURL := c.Param("id"); chatIDFromURL != "" && req.ChatID == "" {
			req.ChatID = chatIDFromURL
		}
		
		if req.ChatID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "chatId is required"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", req.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Если пересылка, загружаем исходное сообщение
		var forwardFromChatID string
		if req.ForwardFrom != "" {
			var originalMessage models.Message
			if err := db.First(&originalMessage, "id = ?", req.ForwardFrom).Error; err == nil {
				forwardFromChatID = originalMessage.ChatID
			}
		}

		message := models.Message{
			ID:            uuid.New().String(),
			ChatID:        req.ChatID,
			SenderID:      userIDStr,
			Text:          req.Text,
			AttachmentURL: req.AttachmentURL,
			ReplyTo:       req.ReplyTo,
			ForwardFrom:   req.ForwardFrom,
			ThreadID:      req.ThreadID,
			StickerID:     req.StickerID,
			GifURL:        req.GifURL,
			LocationLat:   req.LocationLat,
			LocationLon:   req.LocationLon,
		}

		if err := db.Create(&message).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем полную информацию о сообщении
		db.Preload("Sender").Preload("Reactions").First(&message, "id = ?", message.ID)

		// Загружаем информацию о сообщении, на которое отвечают
		var replyToMessage *models.Message
		if message.ReplyTo != "" {
			var replyMsg models.Message
			if err := db.Preload("Sender").First(&replyMsg, "id = ?", message.ReplyTo).Error; err == nil {
				replyToMessage = &replyMsg
			}
		}

		// Формируем ответ для API
		response := gin.H{
			"id":            message.ID,
			"chatId":        message.ChatID,
			"senderId":      message.SenderID,
			"text":          message.Text,
			"attachmentUrl":  message.AttachmentURL,
			"replyTo":       message.ReplyTo,
			"forwardFrom":   message.ForwardFrom,
			"forwardFromChatId": forwardFromChatID,
			"threadId":      message.ThreadID,
			"stickerId":     message.StickerID,
			"gifUrl":        message.GifURL,
			"locationLat":   message.LocationLat,
			"locationLon":    message.LocationLon,
			"createdAt":     message.CreatedAt,
		}
		if replyToMessage != nil {
			response["replyToMessage"] = gin.H{
				"id":       replyToMessage.ID,
				"text":     replyToMessage.Text,
				"senderId": replyToMessage.SenderID,
				"sender": gin.H{
					"id":       replyToMessage.Sender.ID,
					"username": replyToMessage.Sender.Username,
					"avatarUrl": replyToMessage.Sender.AvatarURL,
				},
			}
		}
		if message.EditedAt != nil {
			response["editedAt"] = message.EditedAt
		}
		if message.DeletedAt != nil {
			response["deletedAt"] = message.DeletedAt
		}
		if message.ExpiresAt != nil {
			response["expiresAt"] = message.ExpiresAt
		}
		if message.Sender.ID != "" {
			response["sender"] = gin.H{
				"id":       message.Sender.ID,
				"username": message.Sender.Username,
				"avatarUrl": message.Sender.AvatarURL,
			}
		}

		// Отправляем через WebSocket в правильном формате
		wsMessage := gin.H{
			"type": "message",
			"data": response,
		}
		messageJSON, _ := json.Marshal(wsMessage)
		wsHub.BroadcastToChat(req.ChatID, messageJSON)

		// Отправляем push-уведомления всем участникам чата (кроме отправителя)
		go func() {
			var members []models.ChatMember
			if err := db.Where("chat_id = ? AND user_id != ?", req.ChatID, userIDStr).Find(&members).Error; err == nil {
				for _, member := range members {
					// Получаем информацию о чате для уведомления
					var chat models.Chat
					if err := db.First(&chat, "id = ?", req.ChatID).Error; err == nil {
						chatName := chat.Name
						if chat.Type == "dm" {
							// Для DM получаем имя собеседника
							var otherMember models.ChatMember
							if err := db.Where("chat_id = ? AND user_id != ?", req.ChatID, member.UserID).First(&otherMember).Error; err == nil {
								var otherUser models.User
								if err := db.First(&otherUser, "id = ?", otherMember.UserID).Error; err == nil {
									chatName = otherUser.Username
								}
							}
						}
						
						title := chatName
						if title == "" {
							title = "SafeGram"
						}
						body := message.Text
						if body == "" {
							body = "Новое сообщение"
						}
						if len(body) > 100 {
							body = body[:100] + "..."
						}
						
						SendPushNotification(db, member.UserID, title, body, map[string]interface{}{
							"chatId":    req.ChatID,
							"messageId": message.ID,
							"url":       "/chats/" + req.ChatID,
						})
					}
				}
			}
		}()

		c.JSON(http.StatusOK, response)
	}
}

// AddReaction добавляет реакцию к сообщению
func AddReaction(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Emoji string `json:"emoji" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Проверяем существование сообщения
		var message models.Message
		if err := db.First(&message, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Удаляем существующую реакцию этого пользователя
		db.Where("message_id = ? AND user_id = ?", messageID, userIDStr).Delete(&models.MessageReaction{})

		// Создаем новую реакцию
		reaction := models.MessageReaction{
			ID:        uuid.New().String(),
			MessageID: messageID,
			UserID:    userIDStr,
			Emoji:     req.Emoji,
		}

		if err := db.Create(&reaction).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Формируем данные реакции для WebSocket
		reactionData := gin.H{
			"type": "reaction",
			"data": gin.H{
				"messageId": messageID,
				"chatId":    message.ChatID,
				"userId":    userIDStr,
				"emoji":     req.Emoji,
			},
		}
		reactionJSON, _ := json.Marshal(reactionData)
		wsHub.BroadcastToChat(message.ChatID, reactionJSON)

		c.JSON(http.StatusOK, reaction)
	}
}

// EditMessage редактирует сообщение
func EditMessage(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Text string `json:"text" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var message models.Message
		if err := db.First(&message, "id = ? AND sender_id = ?", messageID, userIDStr).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		now := time.Now()
		message.Text = req.Text
		message.EditedAt = &now

		if err := db.Save(&message).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Формируем данные для WebSocket
		editData := gin.H{
			"id":           message.ID,
			"chatId":       message.ChatID,
			"senderId":     message.SenderID,
			"text":         message.Text,
			"attachmentUrl": message.AttachmentURL,
			"editedAt":     message.EditedAt,
			"createdAt":    message.CreatedAt,
		}
		
		// Отправляем через WebSocket
		editJSON, _ := json.Marshal(gin.H{
			"type": "message:update",
			"data": editData,
		})
		wsHub.BroadcastToChat(message.ChatID, editJSON)

		c.JSON(http.StatusOK, message)
	}
}

// DeleteMessage удаляет сообщение
func DeleteMessage(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var message models.Message
		if err := db.First(&message, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем права (только отправитель или админ)
		if message.SenderID != userIDStr {
			// Проверяем, является ли пользователь админом
			var user models.User
			if err := db.First(&user, "id = ?", userIDStr).Error; err == nil {
				roles := user.ParseRoles()
				isAdmin := false
				for _, role := range roles {
					if role == "admin" || role == "owner" {
						isAdmin = true
						break
					}
				}
				if !isAdmin {
					c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
					return
				}
			} else {
				c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
				return
			}
		}

		now := time.Now()
		message.DeletedAt = &now

		if err := db.Save(&message).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Отправляем через WebSocket
		deleteJSON, _ := json.Marshal(gin.H{
			"type": "message:delete",
			"data": gin.H{
				"messageId": messageID,
				"chatId":    message.ChatID,
				"deleteForAll": true, // Пока всегда true, можно добавить в запрос
			},
		})
		wsHub.BroadcastToChat(message.ChatID, deleteJSON)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// MarkMessageRead отмечает сообщение как прочитанное
func MarkMessageRead(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем существование сообщения
		var message models.Message
		if err := db.First(&message, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", message.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Проверяем, не прочитано ли уже
		var existingReceipt models.MessageReadReceipt
		if err := db.Where("message_id = ? AND user_id = ?", messageID, userIDStr).First(&existingReceipt).Error; err == nil {
			// Уже прочитано
			c.JSON(http.StatusOK, existingReceipt)
			return
		}

		// Создаем запись о прочтении
		receipt := models.MessageReadReceipt{
			ID:        uuid.New().String(),
			MessageID: messageID,
			UserID:    userIDStr,
		}

		if err := db.Create(&receipt).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Отправляем уведомление отправителю через WebSocket
		readJSON, _ := json.Marshal(gin.H{
			"type": "message:read",
			"data": gin.H{
				"messageId": messageID,
				"chatId":    message.ChatID,
				"userId":    userIDStr,
				"readAt":    receipt.ReadAt,
			},
		})
		wsHub.SendToUser(message.SenderID, readJSON)

		c.JSON(http.StatusOK, receipt)
	}
}

// MarkChatRead отмечает все сообщения в чате как прочитанные
func MarkChatRead(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Получаем все непрочитанные сообщения в чате
		var unreadMessages []models.Message
		subquery := db.Model(&models.MessageReadReceipt{}).
			Select("message_id").
			Where("user_id = ?", userIDStr)
		
		db.Where("chat_id = ? AND sender_id != ? AND deleted_at IS NULL", chatID, userIDStr).
			Where("id NOT IN (?)", subquery).
			Find(&unreadMessages)

		// Создаем записи о прочтении для всех непрочитанных сообщений
		receipts := make([]models.MessageReadReceipt, 0, len(unreadMessages))
		senderIDs := make(map[string]bool)

		for _, msg := range unreadMessages {
			receipt := models.MessageReadReceipt{
				ID:        uuid.New().String(),
				MessageID: msg.ID,
				UserID:    userIDStr,
			}
			receipts = append(receipts, receipt)
			senderIDs[msg.SenderID] = true
		}

		if len(receipts) > 0 {
			// Массовое создание записей
			if err := db.Create(&receipts).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
				return
			}

			// Отправляем уведомления всем отправителям
			readJSON, _ := json.Marshal(gin.H{
				"type": "chat:read",
				"data": gin.H{
					"chatId": chatID,
					"userId": userIDStr,
					"readAt": time.Now(),
				},
			})

			for senderID := range senderIDs {
				wsHub.SendToUser(senderID, readJSON)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"readCount": len(receipts),
		})
	}
}

// GetMessageReadReceipts получает список пользователей, прочитавших сообщение
func GetMessageReadReceipts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем существование сообщения
		var message models.Message
		if err := db.First(&message, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем доступ к чату
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", message.ChatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Получаем все записи о прочтении
		var receipts []models.MessageReadReceipt
		if err := db.Where("message_id = ?").
			Preload("User").
			Order("read_at DESC").
			Find(&receipts).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Формируем ответ
		result := make([]gin.H, len(receipts))
		for i, receipt := range receipts {
			result[i] = gin.H{
				"userId": receipt.UserID,
				"readAt": receipt.ReadAt,
				"user": gin.H{
					"id":       receipt.User.ID,
					"username": receipt.User.Username,
					"avatarUrl": receipt.User.AvatarURL,
				},
			}
		}

		c.JSON(http.StatusOK, gin.H{"receipts": result})
	}
}

// ForwardMessage пересылает сообщение в другой чат
func ForwardMessage(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			ChatID string `json:"chatId" binding:"required"` // ID чата, куда пересылаем
			Text   string `json:"text"`                      // Опциональный комментарий
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Проверяем существование исходного сообщения
		var originalMessage models.Message
		if err := db.Preload("Sender").First(&originalMessage, "id = ?", messageID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем доступ к исходному чату
		var originalMember models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", originalMessage.ChatID, userIDStr).First(&originalMember).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "detail": "no_access_to_source_chat"})
			return
		}

		// Проверяем доступ к целевому чату
		var targetMember models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", req.ChatID, userIDStr).First(&targetMember).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "detail": "no_access_to_target_chat"})
			return
		}

		// Создаем новое сообщение с пересылкой
		forwardedMessage := models.Message{
			ID:            uuid.New().String(),
			ChatID:        req.ChatID,
			SenderID:      userIDStr,
			Text:          req.Text, // Комментарий к пересылке
			ForwardFrom:   messageID,
			AttachmentURL: originalMessage.AttachmentURL,
			StickerID:     originalMessage.StickerID,
			GifURL:        originalMessage.GifURL,
			LocationLat:   originalMessage.LocationLat,
			LocationLon:   originalMessage.LocationLon,
		}

		// Если нет комментария, используем текст исходного сообщения
		if forwardedMessage.Text == "" {
			forwardedMessage.Text = originalMessage.Text
		}

		if err := db.Create(&forwardedMessage).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем полную информацию о пересланном сообщении
		db.Preload("Sender").Preload("Reactions").First(&forwardedMessage, "id = ?", forwardedMessage.ID)

		// Загружаем информацию об исходном сообщении для ответа
		var originalSender models.User
		db.First(&originalSender, "id = ?", originalMessage.SenderID)

		// Формируем ответ для API
		response := gin.H{
			"id":            forwardedMessage.ID,
			"chatId":        forwardedMessage.ChatID,
			"senderId":      forwardedMessage.SenderID,
			"text":          forwardedMessage.Text,
			"attachmentUrl": forwardedMessage.AttachmentURL,
			"forwardFrom":   forwardedMessage.ForwardFrom,
			"forwardFromChatId": originalMessage.ChatID,
			"stickerId":     forwardedMessage.StickerID,
			"gifUrl":        forwardedMessage.GifURL,
			"locationLat":   forwardedMessage.LocationLat,
			"locationLon":   forwardedMessage.LocationLon,
			"createdAt":     forwardedMessage.CreatedAt,
			"forwardedMessage": gin.H{
				"id":       originalMessage.ID,
				"text":     originalMessage.Text,
				"senderId": originalMessage.SenderID,
				"sender": gin.H{
					"id":       originalSender.ID,
					"username": originalSender.Username,
					"avatarUrl": originalSender.AvatarURL,
				},
				"attachmentUrl": originalMessage.AttachmentURL,
				"createdAt":     originalMessage.CreatedAt,
			},
		}
		if forwardedMessage.Sender.ID != "" {
			response["sender"] = gin.H{
				"id":       forwardedMessage.Sender.ID,
				"username": forwardedMessage.Sender.Username,
				"avatarUrl": forwardedMessage.Sender.AvatarURL,
			}
		}

		// Отправляем через WebSocket
		wsMessage := gin.H{
			"type": "message",
			"data": response,
		}
		messageJSON, _ := json.Marshal(wsMessage)
		wsHub.BroadcastToChat(req.ChatID, messageJSON)

		c.JSON(http.StatusOK, response)
	}
}

