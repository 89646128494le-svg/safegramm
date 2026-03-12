package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

const (
	userStatusBanned    = "banned"
	userStatusSuspended = "suspended"
)

var notificationDB *gorm.DB

func setNotificationDB(db *gorm.DB) {
	notificationDB = db
}

func normalizeUserStatus(status string) string {
	return strings.ToLower(strings.TrimSpace(status))
}

func isUserBannedStatus(status string) bool {
	return normalizeUserStatus(status) == userStatusBanned
}

func isUserSuspendedStatus(status string) bool {
	return normalizeUserStatus(status) == userStatusSuspended
}

func isUserAccessBlockedStatus(status string) bool {
	switch normalizeUserStatus(status) {
	case userStatusBanned, userStatusSuspended:
		return true
	default:
		return false
	}
}

func canDeliverUserNotifications(status string) bool {
	return !isUserAccessBlockedStatus(status)
}

func blockedAccountError(status string) (string, string) {
	if isUserSuspendedStatus(status) {
		return "user_suspended", "Ваш аккаунт временно приостановлен администрацией."
	}
	return "user_banned", "Ваш аккаунт заблокирован администрацией."
}

func rejectBlockedAccount(c *gin.Context, status string) bool {
	if !isUserAccessBlockedStatus(status) {
		return false
	}
	errCode, message := blockedAccountError(status)
	c.JSON(http.StatusForbidden, gin.H{
		"error":   errCode,
		"message": message,
	})
	c.Abort()
	return true
}

func loadUserStatusByID(db *gorm.DB, userID string) (string, error) {
	var user models.User
	if err := db.Select("status").First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		return "", err
	}
	return user.Status, nil
}

func revokeUserSessions(db *gorm.DB, userID string) {
	if db == nil || strings.TrimSpace(userID) == "" {
		return
	}
	_ = db.Model(&models.Session{}).
		Where("user_id = ? AND is_active = ?", strings.TrimSpace(userID), true).
		Update("is_active", false).Error
}

func notificationAllowedForUser(userID string) bool {
	userID = strings.TrimSpace(userID)
	if userID == "" || notificationDB == nil {
		return true
	}
	status, err := loadUserStatusByID(notificationDB, userID)
	if err != nil {
		return false
	}
	return canDeliverUserNotifications(status)
}
