package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/audit"
	"safegram-server/internal/database"
	"safegram-server/internal/models"
	"safegram-server/internal/telegram"
	"safegram-server/internal/websocket"
)

// OnOwnerShutdown вызывается при POST /owner/shutdown (только RoleOwner). Main должен установить и обработать.
var OnOwnerShutdown func()

// OnOwnerRestart вызывается при POST /owner/restart (только RoleOwner).
var OnOwnerRestart func()

// RequireOwner проверяет, что пользователь является владельцем платформы
func RequireOwner(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			c.Abort()
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			c.Abort()
			return
		}

		roles := user.ParseRoles()
		isOwner := false
		for _, role := range roles {
			if role == "owner" {
				isOwner = true
				break
			}
		}

		if !isOwner {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "detail": "owner_only"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetOwnerDashboard возвращает статистику для панели владельца
func GetOwnerDashboard(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var stats gin.H

		// Статистика пользователей
		var totalUsers int64
		var premiumUsers int64
		var activeUsers int64
		db.Model(&models.User{}).Count(&totalUsers)
		db.Model(&models.User{}).Where("plan = ?", "premium").Count(&premiumUsers)
		db.Model(&models.User{}).Where("last_seen > ?", time.Now().Add(-7*24*time.Hour)).Count(&activeUsers)

		// Статистика чатов
		var totalChats int64
		var groupChats int64
		var channelChats int64
		db.Model(&models.Chat{}).Count(&totalChats)
		db.Model(&models.Chat{}).Where("type = ?", "group").Count(&groupChats)
		db.Model(&models.Chat{}).Where("type = ?", "channel").Count(&channelChats)

		// Статистика сообщений
		var totalMessages int64
		var messagesLast24h int64
		db.Model(&models.Message{}).Count(&totalMessages)
		db.Model(&models.Message{}).Where("created_at > ?", time.Now().Add(-24*time.Hour)).Count(&messagesLast24h)

		// Статистика серверов
		var totalServers int64
		db.Model(&models.Server{}).Count(&totalServers)

		// Последние регистрации
		var recentUsers []models.User
		db.Order("created_at DESC").Limit(10).Find(&recentUsers)
		recentUsersData := make([]gin.H, len(recentUsers))
		for i, u := range recentUsers {
			recentUsersData[i] = gin.H{
				"id":       u.ID,
				"username": u.Username,
				"email":    func() string { if u.Email != nil { return *u.Email }; return "" }(),
				"plan":     u.Plan,
				"createdAt": u.CreatedAt.Unix() * 1000,
			}
		}

		stats = gin.H{
			"users": gin.H{
				"total":   totalUsers,
				"premium": premiumUsers,
				"active":  activeUsers,
				"recent":  recentUsersData,
			},
			"chats": gin.H{
				"total":   totalChats,
				"groups":  groupChats,
				"channels": channelChats,
			},
			"messages": gin.H{
				"total":      totalMessages,
				"last24h":    messagesLast24h,
			},
			"servers": gin.H{
				"total": totalServers,
			},
			"timestamp": time.Now().Unix() * 1000,
		}

		c.JSON(http.StatusOK, stats)
	}
}

// SetUserPlan устанавливает план пользователя (free/premium)
func SetUserPlan(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var req struct {
			Plan string `json:"plan" binding:"required"` // free, premium
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if req.Plan != "free" && req.Plan != "premium" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_plan"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		user.Plan = req.Plan
		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "plan": user.Plan})
	}
}

// SetUserRole устанавливает роль пользователя
func SetUserRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var req struct {
			Roles []string `json:"roles" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что не удаляем роль owner у владельца
		currentRoles := user.ParseRoles()
		hasOwner := false
		for _, r := range currentRoles {
			if r == "owner" {
				hasOwner = true
				break
			}
		}

		willHaveOwner := false
		for _, r := range req.Roles {
			if r == "owner" {
				willHaveOwner = true
				break
			}
		}

		if hasOwner && !willHaveOwner {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot_remove_owner_role"})
			return
		}

		rolesJSON, _ := json.Marshal(req.Roles)
		user.Roles = string(rolesJSON)
		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "roles": req.Roles})
	}
}

// DeleteUser удаляет пользователя (только для владельца)
func DeleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")

		// Нельзя удалить себя
		if userID == currentUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_delete_self"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Нельзя удалить владельца
		roles := user.ParseRoles()
		for _, role := range roles {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_delete_owner"})
				return
			}
		}

		// Мягкое удаление
		if err := db.Delete(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetSystemSettings возвращает системные настройки
func GetSystemSettings(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// В будущем можно хранить в отдельной таблице
		settings := gin.H{
			"maintenance": false,
			"registrationEnabled": true,
			"maxFileSize": 100 * 1024 * 1024, // 100MB
			"maxChatMembers": 200000,
			"premiumPrice": 299, // рублей в месяц
			"premiumFeatures": []string{
				"Увеличенный лимит загрузки файлов",
				"Приоритетная поддержка",
				"Расширенные настройки приватности",
				"Неограниченное количество чатов",
				"Экспорт истории",
			},
		}

		c.JSON(http.StatusOK, settings)
	}
}

// UpdateSystemSettings обновляет системные настройки
func UpdateSystemSettings(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Maintenance         *bool `json:"maintenance"`
			RegistrationEnabled *bool `json:"registrationEnabled"`
			MaxFileSize         *int64 `json:"maxFileSize"`
			MaxChatMembers      *int `json:"maxChatMembers"`
			PremiumPrice        *int `json:"premiumPrice"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// В будущем сохранять в БД
		// Пока просто возвращаем успех
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// ClearDatabase полностью очищает все таблицы БД (только для владельца)
func ClearDatabase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := database.ClearAll(db); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "errorCode": "DB_CLEAR_FAILED"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "database_cleared"})
	}
}

// OwnerShutdown обрабатывает команду SHUTDOWN (только для RoleOwner, например Lev).
func OwnerShutdown() gin.HandlerFunc {
	return func(c *gin.Context) {
		if OnOwnerShutdown != nil {
			go OnOwnerShutdown()
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "shutdown_initiated"})
	}
}

// OwnerRestart обрабатывает команду RESTART (только для RoleOwner).
func OwnerRestart() gin.HandlerFunc {
	return func(c *gin.Context) {
		if OnOwnerRestart != nil {
			go OnOwnerRestart()
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "restart_initiated"})
	}
}

// GetNetworkTopology возвращает IP, с которых подключены админы/владельцы.
func GetNetworkTopology(db *gorm.DB, wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conns := wsHub.GetConnections()
		type entry struct {
			UserID   string `json:"userId"`
			Username string `json:"username,omitempty"`
			IP       string `json:"ip"`
			Role     string `json:"role"`
		}
		var result []entry
		seen := make(map[string]bool)
		for _, conn := range conns {
			if seen[conn.UserID] {
				continue
			}
			var user models.User
			if err := db.First(&user, "id = ?", conn.UserID).Error; err != nil {
				continue
			}
			roles := user.ParseRoles()
			role := "user"
			for _, r := range roles {
				if r == "owner" || r == "admin" {
					role = r
					break
				}
			}
			if role == "user" {
				continue
			}
			seen[conn.UserID] = true
			ip := conn.IP
			if idx := strings.Index(ip, ":"); idx > 0 {
				ip = ip[:idx]
			}
			result = append(result, entry{
				UserID:   user.ID,
				Username: user.Username,
				IP:       ip,
				Role:     role,
			})
		}
		c.JSON(http.StatusOK, gin.H{"admins": result})
	}
}

// SendLogReportToTelegram отправляет последние записи admin.audit владельцу в Telegram.
func SendLogReportToTelegram() gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 30
		records, err := audit.ReadLastRecords(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "errorCode": "AUDIT_READ_FAILED"})
			return
		}
		var b strings.Builder
		b.WriteString("📋 <b>SafeGram Audit (последние ")
		b.WriteString(fmt.Sprintf("%d", len(records)))
		b.WriteString(")</b>\n")
		for i, r := range records {
			ts := r.Timestamp.Format("02.01 15:04")
			b.WriteString(fmt.Sprintf("%d. %s | %s | %s → %s | %s\n", i+1, ts, r.Action, r.AdminName, r.Target, r.Reason))
		}
		if len(records) == 0 {
			b.WriteString("Записей нет.")
		}
		msg := b.String()
		if len(msg) > 4000 {
			msg = msg[:3997] + "..."
		}
		if !telegram.Send(msg) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "telegram_not_configured", "errorCode": "TELEGRAM_SEND_FAILED"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "sent": len(records)})
	}
}

