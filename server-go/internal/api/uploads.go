package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
	"safegram-server/internal/websocket"
)

const (
	uploadsDir = "./uploads"
	maxFileSize = 50 * 1024 * 1024 // 50 MB
)

func init() {
	os.MkdirAll(uploadsDir, 0755)
	os.MkdirAll(filepath.Join(uploadsDir, "avatars"), 0755)
	os.MkdirAll(filepath.Join(uploadsDir, "attachments"), 0755)
	os.MkdirAll(filepath.Join(uploadsDir, "stickers"), 0755)
}

// UploadAvatar загружает аватар пользователя
func UploadAvatar(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		file, err := c.FormFile("avatar")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "No file provided"})
			return
		}

		// Проверка размера
		if file.Size > maxFileSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "File too large"})
			return
		}

		// Проверка типа файла
		ext := strings.ToLower(filepath.Ext(file.Filename))
		allowedExts := []string{".jpg", ".jpeg", ".png", ".gif", ".webp"}
		allowed := false
		for _, e := range allowedExts {
			if ext == e {
				allowed = true
				break
			}
		}
		if !allowed {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "Invalid file type"})
			return
		}

		// Генерируем уникальное имя файла
		filename := fmt.Sprintf("%s_%d%s", userIDStr, time.Now().Unix(), ext)
		filepath := filepath.Join(uploadsDir, "avatars", filename)

		// Сохраняем файл
		if err := c.SaveUploadedFile(file, filepath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Обновляем URL аватара в БД
		avatarURL := fmt.Sprintf("/uploads/avatars/%s", filename)
		if err := db.Model(&models.User{}).Where("id = ?", userIDStr).Update("avatar_url", avatarURL).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"avatarUrl": avatarURL})
	}
}

// UploadAttachment загружает вложение в чат
func UploadAttachment(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
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

		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "No file provided"})
			return
		}

		// Проверка размера
		if file.Size > maxFileSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "File too large"})
			return
		}

		// Генерируем уникальное имя файла
		ext := filepath.Ext(file.Filename)
		filename := fmt.Sprintf("%s_%s_%d%s", chatID, uuid.New().String(), time.Now().Unix(), ext)
		filePath := filepath.Join(uploadsDir, "attachments", filename)

		// Сохраняем файл
		if err := c.SaveUploadedFile(file, filePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		attachmentURL := fmt.Sprintf("/uploads/attachments/%s", filename)

		// Создаем сообщение с вложением
		text := c.PostForm("text")
		message := models.Message{
			ID:            uuid.New().String(),
			ChatID:        chatID,
			SenderID:      userIDStr,
			Text:          text,
			AttachmentURL: attachmentURL,
		}

		if err := db.Create(&message).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Загружаем полную информацию о сообщении
		db.Preload("Sender").Preload("Reactions").First(&message, "id = ?", message.ID)

		// Отправляем через WebSocket
		messageJSON, _ := json.Marshal(gin.H{"type": "message", "data": message})
		wsHub.BroadcastToChat(chatID, messageJSON)

		c.JSON(http.StatusOK, gin.H{"message": message})
	}
}

// ServeUploads отдает загруженные файлы
func ServeUploads() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Param("filepath")
		filePath := filepath.Join(uploadsDir, path)
		
		// Проверка безопасности (предотвращение path traversal)
		if !strings.HasPrefix(filepath.Clean(filePath), filepath.Clean(uploadsDir)) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		c.File(filePath)
	}
}

