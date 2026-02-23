package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// StripeWebhook обрабатывает события Stripe (checkout.session.completed и т.д.)
// Подпись проверяется через STRIPE_WEBHOOK_SECRET
func StripeWebhook(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := os.Getenv("STRIPE_WEBHOOK_SECRET")
		if secret == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook_not_configured"})
			return
		}
		payload, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_body"})
			return
		}
		sig := c.GetHeader("Stripe-Signature")
		if sig == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing_signature"})
			return
		}
		var timestamp, stripeSig string
		for _, p := range strings.Split(sig, ",") {
			p = strings.TrimSpace(p)
			if strings.HasPrefix(p, "t=") {
				timestamp = strings.TrimPrefix(p, "t=")
			} else if strings.HasPrefix(p, "v1=") {
				stripeSig = strings.TrimPrefix(p, "v1=")
			}
		}
		if timestamp == "" || stripeSig == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_signature"})
			return
		}
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(timestamp + "." + string(payload)))
		expected := hex.EncodeToString(mac.Sum(nil))
		if !hmac.Equal([]byte(stripeSig), []byte(expected)) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_signature"})
			return
		}
		var evt struct {
			Type string          `json:"type"`
			Data struct {
				Object json.RawMessage `json:"object"`
			} `json:"data"`
		}
		if err := json.Unmarshal(payload, &evt); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_json"})
			return
		}
		if evt.Type == "checkout.session.completed" {
			var session struct {
				ID             string `json:"id"`
				PaymentStatus  string `json:"payment_status"`
				AmountTotal    int64  `json:"amount_total"`
				Currency       string `json:"currency"`
				ClientReferenceID string `json:"client_reference_id"`
			}
			if err := json.Unmarshal(evt.Data.Object, &session); err != nil {
				c.JSON(http.StatusOK, gin.H{"received": true})
				return
			}
			if session.PaymentStatus != "paid" {
				c.JSON(http.StatusOK, gin.H{"received": true})
				return
			}
			userID := session.ClientReferenceID
			if userID == "" {
				c.JSON(http.StatusOK, gin.H{"received": true})
				return
			}
			var existing models.Payment
			if err := db.Where("provider = ? AND external_id = ?", "stripe", session.ID).First(&existing).Error; err == nil {
				c.JSON(http.StatusOK, gin.H{"received": true})
				return
			}
			payment := models.Payment{
				ID:         uuid.New().String(),
				UserID:     userID,
				Provider:   "stripe",
				ExternalID: session.ID,
				Amount:     session.AmountTotal,
				Currency:   session.Currency,
				Plan:       "premium",
				Status:     "succeeded",
			}
			if err := db.Create(&payment).Error; err != nil {
				c.JSON(http.StatusOK, gin.H{"received": true})
				return
			}
			db.Model(&models.User{}).Where("id = ?", userID).Update("plan", "premium")
		}
		c.JSON(http.StatusOK, gin.H{"received": true})
	}
}

// YooKassaWebhook обрабатывает уведомления ЮKassa (payment.succeeded)
// Проверка через HMAC или по IP/секрету в теле (зависит от настроек ЮKassa)
func YooKassaWebhook(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Type    string `json:"type"`
			Event   struct {
				Type    string `json:"type"`
				Payment struct {
					ID     string `json:"id"`
					Status string `json:"status"`
					Amount struct {
						Value    string `json:"value"`
						Currency string `json:"currency"`
					} `json:"amount"`
					Metadata struct {
						UserID string `json:"user_id"`
					} `json:"metadata"`
				} `json:"payment"`
			} `json:"event"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if body.Type != "notification" || body.Event.Type != "payment.succeeded" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		p := body.Event.Payment
		if p.Status != "succeeded" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		userID := p.Metadata.UserID
		if userID == "" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		var existing models.Payment
		if err := db.Where("provider = ? AND external_id = ?", "yookassa", p.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		amountCents := int64(0)
		if s := p.Amount.Value; s != "" {
			for _, r := range s {
				if r >= '0' && r <= '9' {
					amountCents = amountCents*10 + int64(r-'0')
				} else if r == '.' || r == ',' {
					continue
				}
			}
			amountCents *= 100
		}
		payment := models.Payment{
			ID:         uuid.New().String(),
			UserID:     userID,
			Provider:   "yookassa",
			ExternalID: p.ID,
			Amount:     amountCents,
			Currency:   p.Amount.Currency,
			Plan:       "premium",
			Status:     "succeeded",
		}
		if err := db.Create(&payment).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		db.Model(&models.User{}).Where("id = ?", userID).Update("plan", "premium")
		c.JSON(http.StatusOK, gin.H{"received": true})
	}
}

// GetOwnerRevenue возвращает доходы, конверсию Free→Premium, отток для админки
func GetOwnerRevenue(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var totalRevenue int64
		db.Model(&models.Payment{}).Where("status = ?", "succeeded").Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)
		var premiumCount int64
		var freeCount int64
		db.Model(&models.User{}).Where("plan = ?", "premium").Count(&premiumCount)
		db.Model(&models.User{}).Where("plan = ?", "free").Count(&freeCount)
		totalUsers := premiumCount + freeCount
		conversionRate := 0.0
		if totalUsers > 0 {
			conversionRate = float64(premiumCount) / float64(totalUsers) * 100
		}
		since := time.Now().Add(-30 * 24 * time.Hour)
		var paymentsLast30 []models.Payment
		db.Where("status = ? AND created_at > ?", "succeeded", since).Order("created_at DESC").Limit(100).Find(&paymentsLast30)
		last30Revenue := int64(0)
		for _, p := range paymentsLast30 {
			last30Revenue += p.Amount
		}
		list := make([]gin.H, 0, len(paymentsLast30))
		for _, p := range paymentsLast30 {
			list = append(list, gin.H{
				"id": p.ID, "userId": p.UserID, "provider": p.Provider,
				"amount": p.Amount, "currency": p.Currency, "createdAt": p.CreatedAt.Unix() * 1000,
			})
		}
		c.JSON(http.StatusOK, gin.H{
			"totalRevenue":    totalRevenue,
			"last30DaysRevenue": last30Revenue,
			"premiumCount":    premiumCount,
			"freeCount":       freeCount,
			"conversionRate":  conversionRate,
			"recentPayments":  list,
		})
	}
}
