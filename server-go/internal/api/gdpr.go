package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
)

func buildUserDataExportPayload(db *gorm.DB, user models.User) ([]byte, error) {
	profile := gin.H{
		"id":           user.ID,
		"username":     user.Username,
		"email":        user.Email,
		"plan":         user.Plan,
		"about":        user.About,
		"status":       user.Status,
		"profileColor": user.ProfileColor,
		"showBio":      user.ShowBio,
		"showAvatar":   user.ShowAvatar,
		"createdAt":    user.CreatedAt.Unix() * 1000,
		"updatedAt":    user.UpdatedAt.Unix() * 1000,
	}
	var members []models.ChatMember
	db.Where("user_id = ?", user.ID).Find(&members)
	chatIDs := make([]string, 0, len(members))
	for _, member := range members {
		chatIDs = append(chatIDs, member.ChatID)
	}

	chatsMeta := make([]gin.H, 0)
	if len(chatIDs) > 0 {
		var chats []models.Chat
		db.Where("id IN ?", chatIDs).Find(&chats)
		for _, chat := range chats {
			var msgCount int64
			db.Model(&models.Message{}).Where("chat_id = ? AND deleted_at IS NULL", chat.ID).Count(&msgCount)
			chatsMeta = append(chatsMeta, gin.H{
				"id":           chat.ID,
				"type":         chat.Type,
				"name":         chat.Name,
				"messageCount": msgCount,
				"createdAt":    chat.CreatedAt.Unix() * 1000,
			})
		}
	}

	var sessions []models.Session
	db.Where("user_id = ?", user.ID).Find(&sessions)
	sessionsList := make([]gin.H, 0, len(sessions))
	for _, session := range sessions {
		sessionsList = append(sessionsList, gin.H{
			"id":        session.ID,
			"userAgent": session.UserAgent,
			"ipAddress": session.IPAddress,
			"createdAt": session.CreatedAt.Unix() * 1000,
			"lastUsed":  session.LastUsed.Unix() * 1000,
		})
	}

	export := gin.H{
		"exportedAt": time.Now().Unix() * 1000,
		"profile":    profile,
		"chats":      chatsMeta,
		"sessions":   sessionsList,
		"notice":     "Messages remain available via dedicated chat export (Premium).",
	}

	return json.MarshalIndent(export, "", "  ")
}

// ExportMyData returns the authenticated user's data export and also emails a short-lived download link.
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

		payload, err := buildUserDataExportPayload(db, user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if emailAddress := userEmailValue(&user); emailAddress != "" {
			token := storeExportDownload(user.ID, payload, "safegram-gdpr-export.json", "application/json; charset=utf-8", 24*time.Hour)
			queueEmailJob("account_export_ready", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendAccountExportReady(emailAddress, user.Username, exportDownloadURL(token), "24 hours")
			})
		}

		c.Header("Content-Type", "application/json; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=safegram-gdpr-export.json")
		c.Writer.Write(payload)
	}
}

// DeleteMyAccount deletes the authenticated user's account and confirms deletion by email if possible.
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
		for _, role := range roles {
			if role == "owner" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "owner_cannot_delete_self"})
				return
			}
		}

		emailAddress := userEmailValue(&user)
		username := user.Username

		db.Where("user_id = ?", userIDStr).Delete(&models.Session{})
		db.Where("user_id = ?", userIDStr).Delete(&models.ChatMember{})
		db.Where("user_id = ? OR contact_id = ?", userIDStr, userIDStr).Delete(&models.Contact{})
		db.Where("user_id = ?", userIDStr).Delete(&models.UserBot{})
		db.Where("user_id = ?", userIDStr).Delete(&models.PushSubscription{})
		if err := db.Delete(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		recordSuspiciousActivity(db, userIDStr, "account_delete", c.ClientIP(), c.GetHeader("User-Agent"), nil)
		if emailAddress != "" {
			queueEmailJob("account_deleted_confirmation", map[string]interface{}{
				"userId": userIDStr,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendAccountDeletedConfirmation(emailAddress, username, supportCenterURL())
			})
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "account_deleted"})
	}
}
