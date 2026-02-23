package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

const tokenBytes = 32
const usernameMaxLen = 32
const usernamePattern = `^[a-z0-9_]+$`

func generateToken() (string, error) {
	b := make([]byte, tokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func normalizeBotUsername(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if len(s) > usernameMaxLen {
		s = s[:usernameMaxLen]
	}
	return regexp.MustCompile(`[^a-z0-9_]`).ReplaceAllString(s, "")
}

// GetBots возвращает список ботов текущего пользователя (без токена)
func GetBots(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		uid, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var list []models.UserBot
		if err := db.Where("user_id = ?", uid).Order("created_at DESC").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		out := make([]gin.H, 0, len(list))
		for _, b := range list {
			out = append(out, gin.H{
				"id":          b.ID,
				"name":        b.Name,
				"username":    b.Username,
				"description": b.Description,
				"isActive":    b.IsActive,
				"createdAt":   b.CreatedAt,
			})
		}
		c.JSON(http.StatusOK, gin.H{"bots": out})
	}
}

// GetBot возвращает одного бота по ID (без токена). Только владелец.
func GetBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		uid, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		id := c.Param("id")
		var b models.UserBot
		if err := db.Where("id = ? AND user_id = ?", id, uid).First(&b).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "bot_not_found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"bot": gin.H{
				"id":          b.ID,
				"name":        b.Name,
				"username":    b.Username,
				"description": b.Description,
				"isActive":    b.IsActive,
				"createdAt":   b.CreatedAt,
			},
		})
	}
}

// CreateBot создаёт бота и возвращает его с токеном (токен только при создании)
func CreateBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		uid, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var req struct {
			Name        string `json:"name"`
			Username    string `json:"username"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		username := normalizeBotUsername(req.Username)
		if username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username_required"})
			return
		}
		if !regexp.MustCompile(usernamePattern).MatchString(username) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username_invalid"})
			return
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name_required"})
			return
		}
		token, err := generateToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "token_generation"})
			return
		}
		bot := models.UserBot{
			ID:          uuid.New().String(),
			UserID:      uid,
			Username:    username,
			Name:        name,
			Description: strings.TrimSpace(req.Description),
			Token:       token,
			IsActive:    true,
		}
		if err := db.Create(&bot).Error; err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				c.JSON(http.StatusConflict, gin.H{"error": "username_taken"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"bot": gin.H{
				"id":          bot.ID,
				"name":        bot.Name,
				"username":    bot.Username,
				"description": bot.Description,
				"isActive":    bot.IsActive,
				"createdAt":   bot.CreatedAt,
				"token":       bot.Token,
			},
		})
	}
}

// UpdateBot обновляет имя и описание бота
func UpdateBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		uid, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		id := c.Param("id")
		var req struct {
			Name        *string `json:"name"`
			Description *string `json:"description"`
			WebhookURL  *string `json:"webhookUrl"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		var b models.UserBot
		if err := db.Where("id = ? AND user_id = ?", id, uid).First(&b).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "bot_not_found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		if req.Name != nil {
			b.Name = strings.TrimSpace(*req.Name)
			if b.Name == "" {
				b.Name = b.Username
			}
		}
		if req.Description != nil {
			b.Description = strings.TrimSpace(*req.Description)
		}
		if req.WebhookURL != nil {
			b.WebhookURL = strings.TrimSpace(*req.WebhookURL)
		}
		if err := db.Save(&b).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"bot": gin.H{
				"id":          b.ID,
				"name":        b.Name,
				"username":    b.Username,
				"description": b.Description,
				"isActive":    b.IsActive,
				"createdAt":   b.CreatedAt,
			},
		})
	}
}

// RevokeBotToken генерирует новый токен и возвращает его (как при создании)
func RevokeBotToken(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		uid, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		id := c.Param("id")
		var b models.UserBot
		if err := db.Where("id = ? AND user_id = ?", id, uid).First(&b).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "bot_not_found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		token, err := generateToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "token_generation"})
			return
		}
		b.Token = token
		if err := db.Save(&b).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"bot": gin.H{
				"id":          b.ID,
				"name":        b.Name,
				"username":    b.Username,
				"description": b.Description,
				"isActive":    b.IsActive,
				"createdAt":   b.CreatedAt,
				"token":       b.Token,
			},
		})
	}
}

// ToggleBot вкл/выкл бота
func ToggleBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		uid, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		id := c.Param("id")
		var req struct {
			IsActive bool `json:"isActive"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		var b models.UserBot
		if err := db.Where("id = ? AND user_id = ?", id, uid).First(&b).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "bot_not_found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		b.IsActive = req.IsActive
		if err := db.Save(&b).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "isActive": b.IsActive})
	}
}

// DeleteBot удаляет бота
func DeleteBot(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		uid, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		id := c.Param("id")
		res := db.Where("id = ? AND user_id = ?", id, uid).Delete(&models.UserBot{})
		if res.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "bot_not_found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
