package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CreateGroup создает новую группу
func CreateGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			IsPublic    bool   `json:"isPublic"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		chat := models.Chat{
			ID:          uuid.New().String(),
			Type:        "group",
			Name:        req.Name,
			Description: req.Description,
			CreatedBy:   userIDStr,
		}

		if err := db.Create(&chat).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Добавляем создателя как owner
		member := models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: chat.ID,
			UserID: userIDStr,
			Role:   "owner",
		}
		db.Create(&member)

		logMemberEvent(db, "chat", chat.ID, userIDStr, userIDStr, "create", gin.H{
			"type": "group",
			"name": chat.Name,
		})

		c.JSON(http.StatusOK, gin.H{"chat": chat})
	}
}

// JoinGroup присоединяет пользователя к группе
func JoinGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var chat models.Chat
		if err := db.First(&chat, "id = ? AND type = ?", groupID, "group").Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, не является ли уже участником
		var existing models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "already_member"})
			return
		}

		member := models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: groupID,
			UserID: userIDStr,
			Role:   "member",
		}
		db.Create(&member)

		logMemberEvent(db, "chat", groupID, userIDStr, userIDStr, "join", nil)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// LeaveGroup покидает группу
func LeaveGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Нельзя покинуть группу, если ты owner (нужно передать права)
		if member.Role == "owner" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "owner_cannot_leave"})
			return
		}

		db.Delete(&member)
		logMemberEvent(db, "chat", groupID, userIDStr, userIDStr, "leave", nil)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// AddGroupMember добавляет участника в группу
func AddGroupMember(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права (owner или admin)
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			UserID string `json:"userId" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// Проверяем, не является ли уже участником
		var existing models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, req.UserID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "already_member"})
			return
		}

		newMember := models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: groupID,
			UserID: req.UserID,
			Role:   "member",
		}
		db.Create(&newMember)

		logMemberEvent(db, "chat", groupID, req.UserID, userIDStr, "add", nil)

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// RemoveGroupMember удаляет участника из группы
func RemoveGroupMember(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		memberUserID := c.Param("userId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Нельзя удалить owner
		var targetMember models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, memberUserID).First(&targetMember).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		if targetMember.Role == "owner" {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot_remove_owner"})
			return
		}

		db.Delete(&targetMember)
		logMemberEvent(db, "chat", groupID, memberUserID, userIDStr, "remove", gin.H{
			"prevRole": targetMember.Role,
		})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// UpdateGroup обновляет информацию о группе
func UpdateGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права (owner или admin)
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		updates := make(map[string]interface{})
		if req.Name != "" {
			updates["name"] = req.Name
		}
		if req.Description != "" {
			updates["description"] = req.Description
		}

		if len(updates) > 0 {
			db.Model(&models.Chat{}).Where("id = ?", groupID).Updates(updates)
		}

		var chat models.Chat
		db.First(&chat, "id = ?", groupID)
		c.JSON(http.StatusOK, gin.H{"chat": chat})
	}
}

// BulkAddGroupMembers массовое добавление участников в группу (owner/admin)
func BulkAddGroupMembers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			UserIDs []string `json:"userIds" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || len(req.UserIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		added := 0
		for _, uid := range req.UserIDs {
			if uid == "" {
				continue
			}
			var existing models.ChatMember
			if err := db.Where("chat_id = ? AND user_id = ?", groupID, uid).First(&existing).Error; err == nil {
				continue
			}
			newMember := models.ChatMember{
				ID:     uuid.New().String(),
				ChatID: groupID,
				UserID: uid,
				Role:   "member",
			}
			if err := db.Create(&newMember).Error; err == nil {
				added++
				logMemberEvent(db, "chat", groupID, uid, userIDStr, "add", gin.H{"bulk": true})
			}
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "added": added})
	}
}

// SetGroupMemberRole меняет роль участника (owner/admin)
func SetGroupMemberRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		groupID := c.Param("id")
		targetUserID := c.Param("userId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Проверяем права
		var member models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			Role string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		allowed := map[string]bool{"owner": true, "admin": true, "moderator": true, "member": true}
		if !allowed[req.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var target models.ChatMember
		if err := db.Where("chat_id = ? AND user_id = ?", groupID, targetUserID).First(&target).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Нельзя менять роль владельца не владельцем
		if target.Role == "owner" && member.Role != "owner" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		prev := target.Role
		target.Role = req.Role
		db.Save(&target)
		logMemberEvent(db, "chat", groupID, targetUserID, userIDStr, "role_change", gin.H{"from": prev, "to": req.Role})

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

