package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

func stringPtr(s string) *string {
	return &s
}

// parseInt преобразует строку в число, возвращает 0 при ошибке
func parseInt(s string) int {
	val, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return val
}

// GetChats возвращает список чатов пользователя
func GetChats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Получаем параметр includeArchived для фильтрации
		includeArchived := c.Query("includeArchived") == "true"
		
		query := db.Where("user_id = ?", userIDStr)
		if !includeArchived {
			// Исключаем заархивированные чаты
			query = query.Where("archived_at IS NULL")
		}
		
		var members []models.ChatMember
		if err := query.Find(&members).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		chatIDs := make([]string, len(members))
		for i, m := range members {
			chatIDs[i] = m.ChatID
		}

		var chats []models.Chat
		if err := db.Where("id IN ?", chatIDs).
			Preload("Members").
			Preload("Members.User").
			Find(&chats).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем последние сообщения для каждого чата и информацию об архивировании
		type ChatWithLastMessage struct {
			models.Chat
			LastMessage *models.Message `json:"lastMessage,omitempty"`
			ArchivedAt  *int64          `json:"archivedAt,omitempty"` // Timestamp архивирования для текущего пользователя
			UnreadCount int             `json:"unreadCount"`           // Количество непрочитанных сообщений
		}
		
		result := make([]ChatWithLastMessage, len(chats))
		for i, chat := range chats {
			var lastMessage models.Message
			err := db.Where("chat_id = ? AND deleted_at IS NULL", chat.ID).
				Order("created_at DESC").
				Limit(1).
				Preload("Sender").
				First(&lastMessage).Error
			
			// Получаем информацию об архивировании для текущего пользователя
			var member models.ChatMember
			var archivedAt *int64
			if err := db.Where("chat_id = ? AND user_id = ?", chat.ID, userIDStr).First(&member).Error; err == nil {
				if member.ArchivedAt != nil {
					timestamp := member.ArchivedAt.Unix() * 1000
					archivedAt = &timestamp
				}
			}
			
			// Подсчитываем непрочитанные сообщения
			// Непрочитанными считаются сообщения, для которых нет записи в MessageReadReceipt
			var unreadCount int64
			subquery := db.Model(&models.MessageReadReceipt{}).
				Select("message_id").
				Where("user_id = ?", userIDStr)
			db.Model(&models.Message{}).
				Where("chat_id = ? AND deleted_at IS NULL AND sender_id != ? AND id NOT IN (?)", 
					chat.ID, userIDStr, subquery).
				Count(&unreadCount)
			
			result[i] = ChatWithLastMessage{
				Chat:        chat,
				LastMessage: func() *models.Message {
					if err == nil && lastMessage.ID != "" {
						return &lastMessage
					}
					return nil
				}(),
				ArchivedAt:  archivedAt,
				UnreadCount: int(unreadCount),
			}
		}

		c.JSON(http.StatusOK, gin.H{"chats": result})
	}
}

// CreateChat создает новый чат
func CreateChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Type        string   `json:"type" binding:"required"`
			Name        string   `json:"name"`
			MemberIDs   []string `json:"memberIds"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		chat := models.Chat{
			ID:        uuid.New().String(),
			Type:      req.Type,
			Name:      req.Name,
			CreatedBy: userIDStr,
		}

		if err := db.Create(&chat).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Добавляем создателя как участника
		ownerMember := models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: chat.ID,
			UserID: userIDStr,
			Role:   "owner",
		}
		db.Create(&ownerMember)

		// Добавляем других участников
		for _, memberID := range req.MemberIDs {
			member := models.ChatMember{
				ID:     uuid.New().String(),
				ChatID: chat.ID,
				UserID: memberID,
				Role:   "member",
			}
			db.Create(&member)
		}

		c.JSON(http.StatusOK, chat)
	}
}

// GetChat возвращает информацию о чате
func GetChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, является ли пользователь участником
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var chat models.Chat
		if err := db.Preload("Members").First(&chat, "id = ?", chatID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		c.JSON(http.StatusOK, chat)
	}
}

// GetMessages возвращает сообщения чата
func GetMessages(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем доступ
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Пагинация
		limit := 100
		if limitStr := c.Query("limit"); limitStr != "" {
			if parsedLimit := parseInt(limitStr); parsedLimit > 0 && parsedLimit <= 500 {
				limit = parsedLimit
			}
		}
		offset := 0
		if offsetStr := c.Query("offset"); offsetStr != "" {
			offset = parseInt(offsetStr)
		}
		beforeID := c.Query("before") // ID сообщения, до которого загружать

		var messages []models.Message
		query := db.Where("chat_id = ? AND deleted_at IS NULL", chatID).
			Preload("Sender").
			Preload("Reactions").
			Preload("Reactions.User").
			Order("created_at DESC").
			Limit(limit)

		// Фильтрация мод-очереди: обычные участники видят только approved и свои pending/rejected
		if member.Role != "owner" && member.Role != "admin" && member.Role != "moderator" {
			query = query.Where("(moderation_status = 'approved' OR sender_id = ?)", userIDStr)
		}
		
		if beforeID != "" {
			// Загружаем сообщения до указанного ID
			var beforeMessage models.Message
			if err := db.First(&beforeMessage, "id = ?", beforeID).Error; err == nil {
				query = query.Where("created_at < ?", beforeMessage.CreatedAt)
			}
		} else if offset > 0 {
			query = query.Offset(offset)
		}
		
		if err := query.Find(&messages).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		
		// Разворачиваем порядок для правильного отображения (от старых к новым)
		for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
			messages[i], messages[j] = messages[j], messages[i]
		}

		// Получаем статусы прочтения для всех сообщений текущим пользователем
		messageIDs := make([]string, len(messages))
		for i, msg := range messages {
			messageIDs[i] = msg.ID
		}
		
		var readReceipts []models.MessageReadReceipt
		if len(messageIDs) > 0 {
			db.Where("message_id IN ? AND user_id = ?", messageIDs, userIDStr).Find(&readReceipts)
		}
		
		readMap := make(map[string]bool)
		for _, receipt := range readReceipts {
			readMap[receipt.MessageID] = true
		}

		// Формируем ответ с информацией о replyToMessage и новых типах
		result := make([]gin.H, len(messages))
		for i, msg := range messages {
			msgData := gin.H{
				"id":            msg.ID,
				"chatId":        msg.ChatID,
				"senderId":      msg.SenderID,
				"text":          msg.Text,
				"ciphertext":    msg.Ciphertext,
				"moderationStatus": msg.ModerationStatus,
				"moderationReason": msg.ModerationReason,
				"attachmentUrl": msg.AttachmentURL,
				"replyTo":       msg.ReplyTo,
				"forwardFrom":   msg.ForwardFrom,
				"threadId":      msg.ThreadID,
				"stickerId":     msg.StickerID,
				"gifUrl":        msg.GifURL,
				"locationLat":   msg.LocationLat,
				"locationLon":    msg.LocationLon,
				"createdAt":     msg.CreatedAt,
			}
			
			// Загружаем опрос если есть
			if msg.PollID != "" {
				var poll models.Poll
				if err := db.Preload("Options").Preload("Votes").Preload("Votes.User").First(&poll, "id = ?", msg.PollID).Error; err == nil {
					totalVotes := int64(len(poll.Votes))
					optionsWithVotes := make([]gin.H, 0)
					for _, opt := range poll.Options {
						voteCount := int64(0)
						voters := make([]string, 0)
						for _, vote := range poll.Votes {
							if vote.OptionID == opt.ID {
								voteCount++
								voters = append(voters, vote.UserID)
							}
						}
						optionsWithVotes = append(optionsWithVotes, gin.H{
							"id":     opt.ID,
							"text":   opt.Text,
							"votes":  voteCount,
							"voters": voters,
						})
					}
					msgData["pollId"] = poll.ID
					msgData["poll"] = gin.H{
						"id":         poll.ID,
						"question":   poll.Question,
						"options":    optionsWithVotes,
						"totalVotes": totalVotes,
					}
				}
			}
			
			// Парсим JSON для календарного события, контакта и документа
			if msg.CalendarEventJSON != "" {
				var calendarEventData gin.H
				if err := json.Unmarshal([]byte(msg.CalendarEventJSON), &calendarEventData); err == nil {
					msgData["calendarEvent"] = calendarEventData
				}
			}
			if msg.ContactJSON != "" {
				var contactData gin.H
				if err := json.Unmarshal([]byte(msg.ContactJSON), &contactData); err == nil {
					msgData["contact"] = contactData
				}
			}
			if msg.DocumentJSON != "" {
				var documentData gin.H
				if err := json.Unmarshal([]byte(msg.DocumentJSON), &documentData); err == nil {
					msgData["document"] = documentData
				}
			}
			
			// Парсим историю редактирования
			if msg.EditHistoryJSON != "" {
				var editHistory []gin.H
				if err := json.Unmarshal([]byte(msg.EditHistoryJSON), &editHistory); err == nil {
					msgData["editHistory"] = editHistory
				}
			}
			if msg.EditedAt != nil {
				msgData["editedAt"] = msg.EditedAt
			}
			if msg.DeletedAt != nil {
				msgData["deletedAt"] = msg.DeletedAt
			}
			if msg.ExpiresAt != nil {
				msgData["expiresAt"] = msg.ExpiresAt
			}
			if msg.Sender.ID != "" {
				msgData["sender"] = gin.H{
					"id":       msg.Sender.ID,
					"username": msg.Sender.Username,
					"avatarUrl": msg.Sender.AvatarURL,
				}
			}

			// Загружаем информацию о сообщении, на которое отвечают
			if msg.ReplyTo != "" {
				var replyMsg models.Message
				if err := db.Preload("Sender").First(&replyMsg, "id = ?", msg.ReplyTo).Error; err == nil {
					msgData["replyToMessage"] = gin.H{
						"id":       replyMsg.ID,
						"text":     replyMsg.Text,
						"senderId": replyMsg.SenderID,
						"sender": gin.H{
							"id":       replyMsg.Sender.ID,
							"username": replyMsg.Sender.Username,
							"avatarUrl": replyMsg.Sender.AvatarURL,
						},
					}
				}
			}

			// Добавляем статус прочтения (только для сообщений не от текущего пользователя)
			if msg.SenderID != userIDStr {
				msgData["isRead"] = readMap[msg.ID]
			}

			result[i] = msgData
		}

		c.JSON(http.StatusOK, gin.H{"messages": result})
	}
}

// GetAttachments возвращает все медиа файлы из чата
func GetAttachments(db *gorm.DB) gin.HandlerFunc {
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

		// Получаем параметр фильтра
		kindFilter := c.Query("kind")

		// Запрос для получения сообщений с вложениями
		query := db.Where("chat_id = ? AND deleted_at IS NULL", chatID).
			Where("(attachment_url IS NOT NULL AND attachment_url != '') OR (gif_url IS NOT NULL AND gif_url != '') OR (sticker_id IS NOT NULL AND sticker_id != '')")

		var messages []models.Message
		if err := query.Order("created_at DESC").Find(&messages).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Формируем список медиа файлов
		type AttachmentItem struct {
			ID        string `json:"id"`
			MessageID string `json:"messageId"`
			ChatID    string `json:"chatId"`
			URL       string `json:"url"`
			Kind      string `json:"kind"`
			CreatedAt int64  `json:"createdAt"`
		}

		attachments := make([]AttachmentItem, 0)

		for _, msg := range messages {
			// Определяем тип медиа по расширению файла
			getKind := func(url string) string {
				if url == "" {
					return ""
				}
				lowerURL := strings.ToLower(url)
				if strings.Contains(lowerURL, ".jpg") || strings.Contains(lowerURL, ".jpeg") || 
				   strings.Contains(lowerURL, ".png") || strings.Contains(lowerURL, ".gif") || 
				   strings.Contains(lowerURL, ".webp") {
					return "image"
				}
				if strings.Contains(lowerURL, ".mp4") || strings.Contains(lowerURL, ".webm") || 
				   strings.Contains(lowerURL, ".mov") || strings.Contains(lowerURL, ".avi") {
					return "video"
				}
				if strings.Contains(lowerURL, ".mp3") || strings.Contains(lowerURL, ".wav") || 
				   strings.Contains(lowerURL, ".ogg") || strings.Contains(lowerURL, ".m4a") {
					return "audio"
				}
				return "file"
			}

			// Добавляем attachment_url
			if msg.AttachmentURL != "" {
				kind := getKind(msg.AttachmentURL)
				if kindFilter == "" || kind == kindFilter {
					attachments = append(attachments, AttachmentItem{
						ID:        uuid.New().String(),
						MessageID: msg.ID,
						ChatID:    msg.ChatID,
						URL:       msg.AttachmentURL,
						Kind:      kind,
						CreatedAt: msg.CreatedAt.Unix() * 1000,
					})
				}
			}

			// Добавляем gif_url
			if msg.GifURL != "" && (kindFilter == "" || kindFilter == "image") {
				attachments = append(attachments, AttachmentItem{
					ID:        uuid.New().String(),
					MessageID: msg.ID,
					ChatID:    msg.ChatID,
					URL:       msg.GifURL,
					Kind:      "image",
					CreatedAt: msg.CreatedAt.Unix() * 1000,
				})
			}

			// Добавляем sticker_id (если есть URL стикера)
			if msg.StickerID != "" && (kindFilter == "" || kindFilter == "image") {
				// Для стикеров используем специальный URL или пропускаем
				// Можно добавить логику для получения URL стикера из базы данных
			}
		}

		c.JSON(http.StatusOK, gin.H{"attachments": attachments})
	}
}

// ArchiveChat архивирует чат для текущего пользователя
func ArchiveChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, что пользователь является участником чата
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Архивируем чат
		now := time.Now()
		member.ArchivedAt = &now
		if err := db.Save(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "archivedAt": now.Unix() * 1000})
	}
}

// UnarchiveChat разархивирует чат для текущего пользователя
func UnarchiveChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем, что пользователь является участником чата
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Разархивируем чат
		member.ArchivedAt = nil
		if err := db.Save(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeleteChat удаляет чат (только для владельца чата или админа)
func DeleteChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем существование чата
		var chat models.Chat
		if err := db.First(&chat, "id = ?", chatID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем права
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", chatID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Проверяем, является ли пользователь владельцем чата или админом платформы
		isOwner := member.Role == "owner"
		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err == nil {
			roles := user.ParseRoles()
			for _, role := range roles {
				if role == "admin" || role == "owner" {
					isOwner = true
					break
				}
			}
		}

		if !isOwner {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "detail": "only_owner_or_admin_can_delete"})
			return
		}

		// Мягкое удаление чата
		if err := db.Delete(&chat).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

