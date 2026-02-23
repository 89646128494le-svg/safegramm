package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// ExportMyData возвращает все данные пользователя (GDPR): профиль, список чатов, сессий, последние сообщения по чатам (метаданные)
func ExportMyData(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		profile := gin.H{
			"id":          user.ID,
			"username":    user.Username,
			"email":       user.Email,
			"plan":        user.Plan,
			"about":       user.About,
			"status":      user.Status,
			"profileColor": user.ProfileColor,
			"showBio":     user.ShowBio,
			"showAvatar":  user.ShowAvatar,
			"createdAt":   user.CreatedAt.Unix() * 1000,
			"updatedAt":   user.UpdatedAt.Unix() * 1000,
		}
		var members []models.ChatMember
		db.Where("user_id = ?", userIDStr).Find(&members)
		chatIDs := make([]string, 0, len(members))
		for _, m := range members {
			chatIDs = append(chatIDs, m.ChatID)
		}
		chatsMeta := make([]gin.H, 0)
		if len(chatIDs) > 0 {
			var chats []models.Chat
			db.Where("id IN ?", chatIDs).Find(&chats)
			for _, ch := range chats {
				var msgCount int64
				db.Model(&models.Message{}).Where("chat_id = ? AND deleted_at IS NULL", ch.ID).Count(&msgCount)
				chatsMeta = append(chatsMeta, gin.H{
					"id": ch.ID, "type": ch.Type, "name": ch.Name,
					"messageCount": msgCount, "createdAt": ch.CreatedAt.Unix() * 1000,
				})
			}
		}
		var sessions []models.Session
		db.Where("user_id = ?", userIDStr).Find(&sessions)
		sessionsList := make([]gin.H, 0, len(sessions))
		for _, s := range sessions {
			sessionsList = append(sessionsList, gin.H{
				"id": s.ID, "userAgent": s.UserAgent, "ipAddress": s.IPAddress,
				"createdAt": s.CreatedAt.Unix() * 1000, "lastUsed": s.LastUsed.Unix() * 1000,
			})
		}
		export := gin.H{
			"exportedAt": time.Now().Unix() * 1000,
			"profile":    profile,
			"chats":      chatsMeta,
			"sessions":   sessionsList,
			"notice":     "Сообщения в чатах экспортируются по отдельности через экспорт чата (Premium).",
		}
		c.Header("Content-Type", "application/json; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=safegram-gdpr-export.json")
		json.NewEncoder(c.Writer).Encode(export)
	}
}

// DeleteMyAccount удаляет аккаунт текущего пользователя с каскадом: выход из чатов, удаление сессий, мягкое удаление пользователя
func DeleteMyAccount(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		roles := user.ParseRoles()
		for _, r := range roles {
			if r == "owner" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "owner_cannot_delete_self"})
				return
			}
		}
		// Удаляем сессии
		db.Where("user_id = ?", userIDStr).Delete(&models.Session{})
		// Удаляем из чатов (members)
		db.Where("user_id = ?", userIDStr).Delete(&models.ChatMember{})
		// Контакты
		db.Where("user_id = ? OR contact_id = ?", userIDStr, userIDStr).Delete(&models.Contact{})
		// Боты пользователя
		db.Where("user_id = ?", userIDStr).Delete(&models.UserBot{})
		// Push-подписки
		db.Where("user_id = ?", userIDStr).Delete(&models.PushSubscription{})
		// Сообщения остаются в чатах (sender_id указывает на удалённого пользователя — при необходимости можно анонимизировать отдельно)
		// Мягкое удаление пользователя
		if err := db.Delete(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "account_deleted"})
	}
}
