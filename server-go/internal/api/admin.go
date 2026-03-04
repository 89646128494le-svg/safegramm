package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/audit"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
	"safegram-server/internal/redis"
)

func logAdminAudit(db *gorm.DB, adminID, targetID, action, details, ip, ua string) {
	entry := models.AdminAuditLog{
		ID:        uuid.New().String(),
		AdminID:   adminID,
		TargetID:  targetID,
		Action:    action,
		Details:   details,
		IP:        ip,
		UserAgent: ua,
	}
	db.Create(&entry)
	audit.LogAdminAction(adminID, "", action, targetID, "", details, ip)
}

func logRoleBanHistory(db *gorm.DB, userID, adminID, action, oldVal, newVal, reason string) {
	entry := models.RoleBanHistory{
		ID:        uuid.New().String(),
		UserID:    userID,
		AdminID:   adminID,
		Action:    action,
		OldValue:  oldVal,
		NewValue:  newVal,
		Reason:    reason,
	}
	db.Create(&entry)
}

// getOnlineCount возвращает количество онлайн пользователей из Redis
func getOnlineCount() int {
	onlineUsers, err := redis.GetOnlineUsers()
	if err != nil {
		return 0
	}
	return len(onlineUsers)
}

// RequireAdmin проверяет, что пользователь является админом
func RequireAdmin(db *gorm.DB) gin.HandlerFunc {
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
		isAdmin := false
		for _, role := range roles {
			if role == "admin" || role == "owner" || role == "sysadmin" {
				isAdmin = true
				break
			}
		}

		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetAdminUsers возвращает список пользователей с фильтрами: plan, search, createdAfter, lastSeenAfter
func GetAdminUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := db.Model(&models.User{})
		if plan := c.Query("plan"); plan != "" {
			q = q.Where("plan = ?", plan)
		}
		if search := strings.TrimSpace(c.Query("search")); search != "" {
			like := "%" + search + "%"
			q = q.Where("username LIKE ? OR id = ? OR (email IS NOT NULL AND email LIKE ?)", like, search, like)
		}
		if createdAfter := c.Query("createdAfter"); createdAfter != "" {
			if t, err := time.Parse("2006-01-02", createdAfter); err == nil {
				q = q.Where("created_at >= ?", t)
			}
		}
		if lastSeenAfter := c.Query("lastSeenAfter"); lastSeenAfter != "" {
			if t, err := time.Parse("2006-01-02", lastSeenAfter); err == nil {
				q = q.Where("last_seen >= ?", t)
			}
		}
		var users []models.User
		if err := q.Order("created_at DESC").Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		result := make([]gin.H, len(users))
		for i, user := range users {
			result[i] = gin.H{
				"id":        user.ID,
				"username": user.Username,
				"email":    func() string { if user.Email != nil { return *user.Email }; return "" }(),
				"roles":    user.ParseRoles(),
				"plan":     user.Plan,
				"status":   user.Status,
				"avatarUrl": user.AvatarURL,
				"createdAt": user.CreatedAt,
				"lastSeen":  user.LastSeen,
			}
		}
		c.JSON(http.StatusOK, gin.H{"users": result})
	}
}

// BlockUser блокирует пользователя
func BlockUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")

		// Нельзя заблокировать себя
		if userID == currentUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_block_self"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что это не owner
		roles := user.ParseRoles()
		for _, role := range roles {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_block_owner"})
				return
			}
		}

		oldRoles, _ := json.Marshal(user.ParseRoles())
		db.Model(&user).Updates(map[string]interface{}{
			"status": "banned",
			"roles":  "[]",
		})
		adminIDStr, _ := currentUserID.(string)
		logRoleBanHistory(db, userID, adminIDStr, "ban", string(oldRoles), "[]", "")
		logAdminAudit(db, adminIDStr, userID, "block_user", "", c.ClientIP(), c.GetHeader("User-Agent"))

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// UnblockUser разблокирует пользователя
func UnblockUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		db.Model(&user).Update("status", "online")
		currentUserID, _ := c.Get("userID")
		if aid, ok := currentUserID.(string); ok {
			logRoleBanHistory(db, userID, aid, "unban", "banned", "online", "")
			logAdminAudit(db, aid, userID, "unblock_user", "", c.ClientIP(), c.GetHeader("User-Agent"))
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// PromoteUser назначает пользователя админом
func PromoteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		roles := user.ParseRoles()
		hasAdmin := false
		for _, role := range roles {
			if role == "admin" {
				hasAdmin = true
				break
			}
		}

		oldRoles := user.Roles
		if !hasAdmin {
			roles = append(roles, "admin")
			user.SetRoles(roles)
			db.Model(&user).Update("roles", user.Roles)
			currentUserID, _ := c.Get("userID")
			if aid, ok := currentUserID.(string); ok {
				logRoleBanHistory(db, userID, aid, "role_add", oldRoles, user.Roles, "")
				logAdminAudit(db, aid, userID, "promote", "", c.ClientIP(), c.GetHeader("User-Agent"))
			}
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "roles": roles})
	}
}

// DemoteUser снимает админ права
func DemoteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		currentUserID, _ := c.Get("userID")

		// Нельзя снять права у себя
		if userID == currentUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_demote_self"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		// Проверяем, что это не owner
		roles := user.ParseRoles()
		for _, role := range roles {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_demote_owner"})
				return
			}
		}

		// Убираем admin из ролей
		newRoles := []string{}
		for _, role := range roles {
			if role != "admin" {
				newRoles = append(newRoles, role)
			}
		}
		oldRoles := user.Roles
		user.SetRoles(newRoles)
		db.Model(&user).Update("roles", user.Roles)
		curUserID, _ := c.Get("userID")
		if aid, ok := curUserID.(string); ok {
			logRoleBanHistory(db, userID, aid, "role_remove", oldRoles, user.Roles, "")
			logAdminAudit(db, aid, userID, "demote", "", c.ClientIP(), c.GetHeader("User-Agent"))
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "roles": newRoles})
	}
}

// GetAdminStats возвращает статистику для админов
func GetAdminStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userCount, chatCount, messageCount int64

		db.Model(&models.User{}).Count(&userCount)
		db.Model(&models.Chat{}).Count(&chatCount)
		db.Model(&models.Message{}).Count(&messageCount)

		var serverCount int64
		db.Model(&models.Server{}).Count(&serverCount)

		c.JSON(http.StatusOK, gin.H{
			"stats": gin.H{
				"users":    userCount,
				"chats":    chatCount,
				"messages": messageCount,
				"servers":  serverCount,
				"online":   getOnlineCount(), // Из Redis
			},
		})
	}
}

// GetAdminFeedback возвращает список обратной связи и заявок на премиум
func GetAdminFeedback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.Feedback
		if err := db.Order("created_at DESC").Limit(500).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, f := range list {
			out[i] = gin.H{"id": f.ID, "userId": f.UserID, "subject": f.Subject, "body": f.Body, "createdAt": f.CreatedAt}
		}
		c.JSON(http.StatusOK, out)
	}
}

// SubmitFeedback создаёт заявку на премиум / обратную связь (авторизованный пользователь)
func SubmitFeedback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok || userIDStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var req struct {
			Subject string `json:"subject" binding:"required"`
			Body    string `json:"body" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "subject and body required"})
			return
		}
		fb := models.Feedback{
			ID:      uuid.New().String(),
			UserID:  userIDStr,
			Subject: req.Subject,
			Body:    req.Body,
		}
		if err := db.Create(&fb).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "id": fb.ID})
	}
}

// SubmitRecruit — публичная заявка в тестировщики/хелперы (без авторизации, с rate limit)
func SubmitRecruit(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email   string `json:"email" binding:"required,email"`
			Name    string `json:"name"`
			Role    string `json:"role" binding:"required,oneof=tester helper"`
			Message string `json:"message"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": "email and role (tester|helper) required"})
			return
		}
		app := models.RecruitApplication{
			ID:      uuid.New().String(),
			Email:   strings.TrimSpace(req.Email),
			Name:    strings.TrimSpace(req.Name),
			Role:    req.Role,
			Message: strings.TrimSpace(req.Message),
		}
		if err := db.Create(&app).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "id": app.ID})
	}
}

// GetAdminRecruit возвращает заявки тестировщиков и хелперов (админ)
func GetAdminRecruit(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var list []models.RecruitApplication
		if err := db.Order("created_at DESC").Limit(500).Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		out := make([]gin.H, len(list))
		for i, a := range list {
				out[i] = gin.H{"id": a.ID, "email": a.Email, "name": a.Name, "role": a.Role, "message": a.Message, "status": a.Status, "declineReason": a.DeclineReason, "createdAt": a.CreatedAt}
		}
		c.JSON(http.StatusOK, out)
	}
}

// ApproveRecruitApplication — принять заявку и отправить письмо
func ApproveRecruitApplication(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var app models.RecruitApplication
		if err := db.First(&app, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if app.Status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "already_processed"})
			return
		}
		app.Status = "approved"
		if err := db.Save(&app).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		name := app.Name
		if name == "" {
			name = app.Email
		}
		to, n := app.Email, name
		go func() {
			_ = email.SendRecruitApproved(to, n)
		}()
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeclineRecruitApplication — отклонить заявку с причиной и отправить письмо
func DeclineRecruitApplication(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Reason string `json:"reason" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "reason_required"})
			return
		}
		var app models.RecruitApplication
		if err := db.First(&app, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if app.Status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "already_processed"})
			return
		}
		app.Status = "declined"
		app.DeclineReason = strings.TrimSpace(req.Reason)
		if err := db.Save(&app).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		name := app.Name
		if name == "" {
			name = app.Email
		}
		to, n, reason := app.Email, name, app.DeclineReason
		go func() {
			_ = email.SendRecruitDeclined(to, n, reason)
		}()
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminReports возвращает список жалоб пользователей
func GetAdminReports(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, []gin.H{})
	}
}

// GetAdminModQueue возвращает очередь модерации
func GetAdminModQueue(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: В будущем можно добавить модель ModerationQueue
		// Пока возвращаем пустой массив
		c.JSON(http.StatusOK, []gin.H{})
	}
}

// ApproveModItem одобряет элемент в очереди модерации
func ApproveModItem(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: В будущем реализовать логику одобрения
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminAnalytics — аналитика за период (range: 7d, 30d), с графиком по дням.
func GetAdminAnalytics(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rangeQ := c.DefaultQuery("range", "7d")
		var days int
		switch rangeQ {
		case "24h":
			days = 1
		case "7d":
			days = 7
		case "30d":
			days = 30
		default:
			days = 7
		}
		var userCount, messageCount int64
		db.Model(&models.User{}).Count(&userCount)
		db.Model(&models.Message{}).Count(&messageCount)
		chart := make([]gin.H, 0, days)
		now := time.Now().UTC()
		for i := days - 1; i >= 0; i-- {
			day := now.AddDate(0, 0, -i)
			start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC)
			end := start.Add(24 * time.Hour)
			var msgCount int64
			db.Model(&models.Message{}).Where("created_at >= ? AND created_at < ?", start, end).Count(&msgCount)
			var newUsers int64
			db.Model(&models.User{}).Where("created_at >= ? AND created_at < ?", start, end).Count(&newUsers)
			chart = append(chart, gin.H{
				"date":       start.Format("2006-01-02"),
				"messages":   msgCount,
				"newUsers":   newUsers,
			})
		}
		c.JSON(http.StatusOK, gin.H{
			"range":       rangeQ,
			"users":       userCount,
			"messages":    messageCount,
			"activeUsers": getOnlineCount(),
			"chart":       chart,
		})
	}
}

// GetAdminBans — список забаненных пользователей (status = banned).
func GetAdminBans(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User
		if err := db.Where("status = ?", "banned").Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		result := make([]gin.H, len(users))
		for i, u := range users {
			result[i] = gin.H{
				"id":       u.ID,
				"userId":   u.ID,
				"username": u.Username,
				"email":    func() string { if u.Email != nil { return *u.Email }; return "" }(),
			}
		}
		c.JSON(http.StatusOK, gin.H{"bans": result})
	}
}

// CreateAdminBan — забанить пользователя по userId из body.
func CreateAdminBan(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			UserID string `json:"userId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		currentUserID, _ := c.Get("userID")
		if body.UserID == currentUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_block_self"})
			return
		}
		var user models.User
		if err := db.First(&user, "id = ?", body.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		for _, role := range user.ParseRoles() {
			if role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "cannot_block_owner"})
				return
			}
		}
		db.Model(&user).Updates(map[string]interface{}{"status": "banned", "roles": "[]"})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// DeleteAdminBan — разбанить пользователя (id в URL — userId).
func DeleteAdminBan(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		db.Model(&user).Update("status", "online")
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetAdminMaintenance — статус техработ (для админки; делегирует GetMaintenanceStatus)
func GetAdminMaintenance(db *gorm.DB) gin.HandlerFunc {
	return GetMaintenanceStatus(db)
}

// GetSystemHealth — проверка БД и Redis.
func GetSystemHealth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sqlDB, err := db.DB()
		dbStatus := "connected"
		if err != nil || sqlDB.Ping() != nil {
			dbStatus = "disconnected"
		}
		redisStatus := "connected"
		if redis.Ping() != nil {
			redisStatus = "disconnected"
		}
		overall := "healthy"
		if dbStatus != "connected" {
			overall = "critical"
		} else if redisStatus != "connected" {
			overall = "warning"
		}
		c.JSON(http.StatusOK, gin.H{
			"status": overall,
			"services": []gin.H{
				{"name": "db", "status": dbStatus, "uptime": 0},
				{"name": "redis", "status": redisStatus, "uptime": 0},
			},
		})
	}
}
