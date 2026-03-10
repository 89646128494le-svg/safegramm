package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/email"
	"safegram-server/internal/logger"
	"safegram-server/internal/models"
	"safegram-server/internal/redis"
)

type pendingEmailChangeData struct {
	UserID    string
	NewEmail  string
	Code      string
	ExpiresAt time.Time
}

type exportDownloadData struct {
	UserID      string
	Filename    string
	ContentType string
	Payload     []byte
	ExpiresAt   time.Time
}

var (
	pendingEmailChangeStorage = make(map[string]pendingEmailChangeData)
	pendingEmailChangeMutex   sync.RWMutex
	exportDownloadStorage     = make(map[string]exportDownloadData)
	exportDownloadMutex       sync.RWMutex
)

func userEmailValue(user *models.User) string {
	if user == nil || user.Email == nil {
		return ""
	}
	return strings.TrimSpace(*user.Email)
}

func fallbackUsernameFromEmail(address string) string {
	address = normalizeEmail(address)
	if address == "" {
		return "Пользователь SafeGram"
	}
	parts := strings.SplitN(address, "@", 2)
	name := strings.TrimSpace(parts[0])
	if name == "" {
		return "Пользователь SafeGram"
	}
	return name
}

func queueEmailJob(label string, metadata map[string]interface{}, send func() error) {
	go func() {
		if err := send(); err != nil {
			logger.Error("email job failed: "+label, err, metadata)
			return
		}
		logger.Info("email job queued: "+label, metadata)
	}()
}

func publicAPIBaseURL() string {
	candidates := []string{
		os.Getenv("PUBLIC_API_URL"),
		os.Getenv("API_BASE_URL"),
		os.Getenv("APP_API_URL"),
		os.Getenv("BACKEND_URL"),
		"https://141.8.198.152.nip.io/api",
	}
	for _, raw := range candidates {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			continue
		}
		path := strings.TrimRight(u.Path, "/")
		if !strings.HasSuffix(path, "/api") {
			if path == "" {
				path = "/api"
			} else {
				path += "/api"
			}
		}
		u.Path = path
		u.RawQuery = ""
		u.Fragment = ""
		return strings.TrimRight(u.String(), "/")
	}
	return "https://141.8.198.152.nip.io/api"
}

func supportCenterURL() string {
	return premiumAppURL() + "/support"
}

func settingsURL() string {
	return premiumAppURL() + "/app/settings"
}

func chatsURL(chatID string) string {
	base := premiumAppURL() + "/app/chats"
	if strings.TrimSpace(chatID) == "" {
		return base
	}
	return base + "?chatId=" + url.QueryEscape(strings.TrimSpace(chatID))
}

func chatInviteURL(inviteLink string) string {
	return premiumAppURL() + "/app/join/" + url.PathEscape(strings.TrimSpace(inviteLink))
}

func serverInviteURL(inviteLink string) string {
	return premiumAppURL() + "/app/servers/join/" + url.PathEscape(strings.TrimSpace(inviteLink))
}

func exportDownloadURL(token string) string {
	return publicAPIBaseURL() + "/exports/" + url.PathEscape(strings.TrimSpace(token))
}

func detailsJSON(details map[string]interface{}) string {
	if len(details) == 0 {
		return ""
	}
	data, err := json.Marshal(details)
	if err != nil {
		return ""
	}
	return string(data)
}

func recordSuspiciousActivity(db *gorm.DB, userID, action, ip, userAgent string, details map[string]interface{}) {
	userID = strings.TrimSpace(userID)
	action = strings.TrimSpace(action)
	if db == nil || userID == "" || action == "" {
		return
	}
	_ = db.Create(&models.SuspiciousActivity{
		ID:        uuid.New().String(),
		UserID:    userID,
		Action:    action,
		IP:        strings.TrimSpace(ip),
		UserAgent: strings.TrimSpace(userAgent),
		Details:   detailsJSON(details),
	}).Error
}

func pendingEmailChangeKey(userID, newEmail string) string {
	return strings.ToLower(strings.TrimSpace(userID)) + "::" + normalizeEmail(newEmail)
}

func storePendingEmailChange(userID, newEmail, code string, expiresIn time.Duration) {
	pendingEmailChangeMutex.Lock()
	defer pendingEmailChangeMutex.Unlock()
	pendingEmailChangeStorage[pendingEmailChangeKey(userID, newEmail)] = pendingEmailChangeData{
		UserID:    strings.TrimSpace(userID),
		NewEmail:  normalizeEmail(newEmail),
		Code:      strings.TrimSpace(code),
		ExpiresAt: time.Now().Add(expiresIn),
	}
}

func verifyPendingEmailChange(userID, newEmail, code string) bool {
	key := pendingEmailChangeKey(userID, newEmail)
	pendingEmailChangeMutex.Lock()
	defer pendingEmailChangeMutex.Unlock()
	item, ok := pendingEmailChangeStorage[key]
	if !ok {
		return false
	}
	if time.Now().After(item.ExpiresAt) {
		delete(pendingEmailChangeStorage, key)
		return false
	}
	if strings.TrimSpace(code) != item.Code {
		return false
	}
	delete(pendingEmailChangeStorage, key)
	return true
}

func storeExportDownload(userID string, payload []byte, filename, contentType string, expiresIn time.Duration) string {
	token := uuid.New().String()
	exportDownloadMutex.Lock()
	defer exportDownloadMutex.Unlock()
	exportDownloadStorage[token] = exportDownloadData{
		UserID:      strings.TrimSpace(userID),
		Filename:    strings.TrimSpace(filename),
		ContentType: strings.TrimSpace(contentType),
		Payload:     payload,
		ExpiresAt:   time.Now().Add(expiresIn),
	}
	return token
}

func getExportDownload(token string) (exportDownloadData, bool) {
	exportDownloadMutex.RLock()
	item, ok := exportDownloadStorage[strings.TrimSpace(token)]
	exportDownloadMutex.RUnlock()
	if !ok {
		return exportDownloadData{}, false
	}
	if time.Now().After(item.ExpiresAt) {
		exportDownloadMutex.Lock()
		delete(exportDownloadStorage, strings.TrimSpace(token))
		exportDownloadMutex.Unlock()
		return exportDownloadData{}, false
	}
	return item, true
}

func resolveInviteRecipient(db *gorm.DB, recipientUserID, rawEmail string) (string, string, error) {
	if trimmedID := strings.TrimSpace(recipientUserID); trimmedID != "" {
		var user models.User
		if err := db.Select("id", "username", "email").First(&user, "id = ?", trimmedID).Error; err != nil {
			return "", "", err
		}
		emailAddress := userEmailValue(&user)
		if emailAddress == "" {
			return "", "", gorm.ErrRecordNotFound
		}
		return emailAddress, user.Username, nil
	}
	emailAddress := normalizeEmail(rawEmail)
	if emailAddress == "" {
		return "", "", nil
	}
	return emailAddress, fallbackUsernameFromEmail(emailAddress), nil
}

func messageEmailPreview(message *models.Message) string {
	if message == nil {
		return "Новое сообщение"
	}
	switch {
	case strings.TrimSpace(message.Ciphertext) != "":
		return "Новое защищенное сообщение"
	case strings.TrimSpace(message.Text) != "":
		text := strings.TrimSpace(message.Text)
		if len([]rune(text)) > 140 {
			return string([]rune(text)[:140]) + "..."
		}
		return text
	case strings.TrimSpace(message.AttachmentURL) != "":
		return "Новое вложение"
	case strings.TrimSpace(message.DocumentJSON) != "":
		return "Новый документ"
	case strings.TrimSpace(message.GifURL) != "":
		return "Новая GIF"
	case strings.TrimSpace(message.StickerID) != "":
		return "Новый стикер"
	default:
		return "Новое сообщение"
	}
}

func queueMessageEmailNotifications(db *gorm.DB, message *models.Message, chatType, chatName, senderName string) {
	if db == nil || message == nil || strings.TrimSpace(message.ChatID) == "" {
		return
	}
	if strings.TrimSpace(chatType) != "dm" {
		return
	}

	var recipients []models.User
	if err := db.Select("users.id", "users.username", "users.email").
		Table("users").
		Joins("JOIN chat_members ON chat_members.user_id = users.id").
		Where("chat_members.chat_id = ? AND chat_members.user_id <> ? AND chat_members.deleted_at IS NULL", message.ChatID, message.SenderID).
		Where("users.deleted_at IS NULL AND users.email IS NOT NULL").
		Find(&recipients).Error; err != nil {
		logger.Error("message notification recipients lookup failed", err, map[string]interface{}{
			"chatId":    message.ChatID,
			"messageId": message.ID,
		})
		return
	}

	preview := messageEmailPreview(message)
	for _, recipient := range recipients {
		emailAddress := userEmailValue(&recipient)
		if emailAddress == "" {
			continue
		}
		if online, _ := redis.IsOnline(recipient.ID); online {
			continue
		}
		recipientCopy := recipient
		queueEmailJob("new_message_notification", map[string]interface{}{
			"userId":    recipientCopy.ID,
			"chatId":    message.ChatID,
			"messageId": message.ID,
		}, func() error {
			return email.SendNewMessageNotification(
				emailAddress,
				recipientCopy.Username,
				senderName,
				preview,
				chatName,
				chatsURL(message.ChatID),
			)
		})
	}
}

func computeUnreadDigest(db *gorm.DB, userID string) (int64, int64, error) {
	subRead := db.Model(&models.MessageReadReceipt{}).
		Select("message_id").
		Where("user_id = ?", userID)
	subChats := db.Model(&models.ChatMember{}).
		Select("chat_id").
		Where("user_id = ? AND deleted_at IS NULL", userID)

	base := db.Model(&models.Message{}).
		Where("chat_id IN (?)", subChats).
		Where("deleted_at IS NULL AND sender_id <> ? AND id NOT IN (?)", userID, subRead)

	var messagesCount int64
	if err := base.Count(&messagesCount).Error; err != nil {
		return 0, 0, err
	}

	var unreadChats int64
	if err := base.Distinct("chat_id").Count(&unreadChats).Error; err != nil {
		return 0, 0, err
	}

	return unreadChats, messagesCount, nil
}

func RequestEmailChange(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok || userIDStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req struct {
			NewEmail string `json:"newEmail" binding:"required,email"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}

		var user models.User
		if err := db.Select("id", "username", "email").First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		newEmail := normalizeEmail(req.NewEmail)
		if newEmail == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if strings.EqualFold(newEmail, userEmailValue(&user)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email_unchanged"})
			return
		}

		var existing models.User
		if err := db.Where("LOWER(email) = LOWER(?) AND id <> ?", newEmail, user.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email_exists"})
			return
		}

		code := generateRandomCode(6)
		storePendingEmailChange(user.ID, newEmail, code, 15*time.Minute)
		queueEmailJob("email_change_verification", map[string]interface{}{
			"userId": user.ID,
			"email":  maskEmail(newEmail),
		}, func() error {
			return email.SendEmailChangeVerification(newEmail, user.Username, code)
		})

		resp := gin.H{
			"ok":       true,
			"message":  "Код подтверждения отправлен на новую почту",
			"newEmail": newEmail,
		}
		if nodeEnv := os.Getenv("NODE_ENV"); nodeEnv == "development" || nodeEnv == "" {
			resp["code"] = code
		}
		c.JSON(http.StatusOK, resp)
	}
}

func ConfirmEmailChange(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok || userIDStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req struct {
			NewEmail string `json:"newEmail" binding:"required,email"`
			Code     string `json:"code" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request", "detail": err.Error()})
			return
		}

		newEmail := normalizeEmail(req.NewEmail)
		if !verifyPendingEmailChange(userIDStr, newEmail, req.Code) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		oldEmail := userEmailValue(&user)
		if err := db.Model(&user).Update("email", &newEmail).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		recordSuspiciousActivity(db, user.ID, "email_change", c.ClientIP(), c.GetHeader("User-Agent"), map[string]interface{}{
			"oldEmail": maskEmail(oldEmail),
			"newEmail": maskEmail(newEmail),
		})

		if oldEmail != "" {
			queueEmailJob("email_changed_old", map[string]interface{}{
				"userId": user.ID,
				"email":  maskEmail(oldEmail),
			}, func() error {
				return email.SendEmailChangedNotification(oldEmail, user.Username, newEmail)
			})
		}
		queueEmailJob("email_changed_new", map[string]interface{}{
			"userId": user.ID,
			"email":  maskEmail(newEmail),
		}, func() error {
			return email.SendEmailChangedNotification(newEmail, user.Username, newEmail)
		})

		c.JSON(http.StatusOK, gin.H{
			"ok":       true,
			"newEmail": newEmail,
			"message":  "Email успешно обновлён",
		})
	}
}

func DownloadAccountExport() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := strings.TrimSpace(c.Param("token"))
		item, ok := getExportDownload(token)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		contentType := item.ContentType
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		filename := item.Filename
		if filename == "" {
			filename = "safegram-export.json"
		}
		c.Header("Content-Type", contentType)
		c.Header("Content-Disposition", "attachment; filename="+filename)
		c.Data(http.StatusOK, contentType, item.Payload)
	}
}

func SendUnreadDigestBatch(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserIDs []string `json:"userIds"`
			Limit   int      `json:"limit"`
		}
		if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		query := db.Model(&models.User{}).Where("email IS NOT NULL").Where("deleted_at IS NULL")
		if len(req.UserIDs) > 0 {
			query = query.Where("id IN ?", req.UserIDs)
		}
		limit := req.Limit
		if limit <= 0 || limit > 500 {
			limit = 200
		}

		var users []models.User
		if err := query.Order("created_at DESC").Limit(limit).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		queued := 0
		for _, user := range users {
			emailAddress := userEmailValue(&user)
			if emailAddress == "" {
				continue
			}
			unreadChats, messagesCount, err := computeUnreadDigest(db, user.ID)
			if err != nil || messagesCount == 0 {
				continue
			}
			queued++
			userCopy := user
			queueEmailJob("unread_digest", map[string]interface{}{
				"userId": userCopy.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendUnreadDigest(emailAddress, userCopy.Username, int(unreadChats), int(messagesCount), chatsURL(""))
			})
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "queued": queued})
	}
}

func SendPremiumExpiringBatch(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserIDs []string `json:"userIds"`
			Days    int      `json:"days"`
			Limit   int      `json:"limit"`
		}
		if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		days := req.Days
		if days <= 0 {
			days = 7
		}
		limit := req.Limit
		if limit <= 0 || limit > 500 {
			limit = 200
		}
		now := time.Now().UTC()
		until := now.Add(time.Duration(days) * 24 * time.Hour)

		query := db.Model(&models.User{}).
			Where("email IS NOT NULL").
			Where("plan = ?", "premium").
			Where("premium_expires_at IS NOT NULL AND premium_expires_at > ? AND premium_expires_at <= ?", now, until).
			Where("deleted_at IS NULL")
		if len(req.UserIDs) > 0 {
			query = query.Where("id IN ?", req.UserIDs)
		}

		var users []models.User
		if err := query.Order("premium_expires_at ASC").Limit(limit).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		queued := 0
		for _, user := range users {
			emailAddress := userEmailValue(&user)
			if emailAddress == "" || user.PremiumExpiresAt == nil {
				continue
			}
			queued++
			expiresLabel := user.PremiumExpiresAt.In(time.Local).Format("02.01.2006 15:04")
			userCopy := user
			queueEmailJob("premium_expiring", map[string]interface{}{
				"userId": userCopy.ID,
				"email":  maskEmail(emailAddress),
			}, func() error {
				return email.SendPremiumExpiring(emailAddress, userCopy.Username, "SafeGram Premium", expiresLabel, premiumBillingURL())
			})
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "queued": queued, "days": days})
	}
}
