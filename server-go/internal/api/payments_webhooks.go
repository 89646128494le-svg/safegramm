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
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// StripeWebhook handles Stripe checkout.session.completed callbacks.
func StripeWebhook(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET"))
		if secret == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook_not_configured"})
			return
		}

		payload, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_body"})
			return
		}
		signature := c.GetHeader("Stripe-Signature")
		if signature == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing_signature"})
			return
		}

		var timestamp, signatureV1 string
		for _, part := range strings.Split(signature, ",") {
			part = strings.TrimSpace(part)
			switch {
			case strings.HasPrefix(part, "t="):
				timestamp = strings.TrimPrefix(part, "t=")
			case strings.HasPrefix(part, "v1="):
				signatureV1 = strings.TrimPrefix(part, "v1=")
			}
		}
		if timestamp == "" || signatureV1 == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_signature"})
			return
		}

		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(timestamp + "." + string(payload)))
		expected := hex.EncodeToString(mac.Sum(nil))
		if !hmac.Equal([]byte(signatureV1), []byte(expected)) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_signature"})
			return
		}

		var evt struct {
			Type string `json:"type"`
			Data struct {
				Object json.RawMessage `json:"object"`
			} `json:"data"`
		}
		if err := json.Unmarshal(payload, &evt); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_json"})
			return
		}
		if evt.Type != "checkout.session.completed" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}

		var session struct {
			ID                string            `json:"id"`
			PaymentStatus     string            `json:"payment_status"`
			AmountTotal       int64             `json:"amount_total"`
			Currency          string            `json:"currency"`
			ClientReferenceID string            `json:"client_reference_id"`
			Metadata          map[string]string `json:"metadata"`
		}
		if err := json.Unmarshal(evt.Data.Object, &session); err != nil {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		if session.PaymentStatus != "paid" || session.ID == "" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}

		var existing models.Payment
		if err := db.Where("provider = ? AND external_id = ?", "stripe", session.ID).First(&existing).Error; err == nil && existing.Status == "succeeded" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}

		userID := strings.TrimSpace(session.ClientReferenceID)
		if userID == "" {
			userID = strings.TrimSpace(session.Metadata["user_id"])
		}
		planID := strings.TrimSpace(session.Metadata["plan_id"])
		if planID == "" {
			planID = "premium_monthly"
		}
		if userID == "" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}

		plan, ok := premiumPlanByID(planID)
		if !ok {
			plan, _ = premiumPlanByID("premium_monthly")
			planID = plan.ID
		}

		var activatedUser *models.User
		if err := db.Transaction(func(tx *gorm.DB) error {
			user, _, err := applySuccessfulPremiumPayment(tx, userID, "stripe", session.ID, planID, session.AmountTotal, session.Currency, map[string]any{
				"clientReferenceId": session.ClientReferenceID,
			})
			if err != nil {
				return err
			}
			activatedUser = user
			return nil
		}); err != nil {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		sendPremiumReceiptEmails(activatedUser, plan)
		c.JSON(http.StatusOK, gin.H{"received": true})
	}
}

// YooKassaWebhook handles payment.succeeded callbacks.
func YooKassaWebhook(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Type   string `json:"type"`
			Object struct {
				ID     string `json:"id"`
				Status string `json:"status"`
				Amount struct {
					Value    string `json:"value"`
					Currency string `json:"currency"`
				} `json:"amount"`
				Metadata struct {
					UserID string `json:"user_id"`
					PlanID string `json:"plan_id"`
				} `json:"metadata"`
			} `json:"object"`
			Event struct {
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
						PlanID string `json:"plan_id"`
					} `json:"metadata"`
				} `json:"payment"`
			} `json:"event"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		paymentID := strings.TrimSpace(body.Object.ID)
		status := strings.TrimSpace(body.Object.Status)
		amountValue := body.Object.Amount.Value
		currency := body.Object.Amount.Currency
		userID := strings.TrimSpace(body.Object.Metadata.UserID)
		planID := strings.TrimSpace(body.Object.Metadata.PlanID)

		if paymentID == "" && body.Type == "notification" && body.Event.Type == "payment.succeeded" {
			paymentID = strings.TrimSpace(body.Event.Payment.ID)
			status = strings.TrimSpace(body.Event.Payment.Status)
			amountValue = body.Event.Payment.Amount.Value
			currency = body.Event.Payment.Amount.Currency
			userID = strings.TrimSpace(body.Event.Payment.Metadata.UserID)
			planID = strings.TrimSpace(body.Event.Payment.Metadata.PlanID)
		}
		if paymentID == "" || status != "succeeded" || userID == "" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		if planID == "" {
			planID = "premium_monthly"
		}

		var existing models.Payment
		if err := db.Where("provider = ? AND external_id = ?", "yookassa", paymentID).First(&existing).Error; err == nil && existing.Status == "succeeded" {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}

		plan, ok := premiumPlanByID(planID)
		if !ok {
			plan, _ = premiumPlanByID("premium_monthly")
			planID = plan.ID
		}

		amountMinor := int64(0)
		digitsAfterPoint := 0
		seenPoint := false
		for _, r := range amountValue {
			switch {
			case r >= '0' && r <= '9':
				amountMinor = amountMinor*10 + int64(r-'0')
				if seenPoint {
					digitsAfterPoint++
				}
			case r == '.' || r == ',':
				if !seenPoint {
					seenPoint = true
				}
			}
		}
		for digitsAfterPoint < 2 {
			amountMinor *= 10
			digitsAfterPoint++
		}
		for digitsAfterPoint > 2 {
			amountMinor /= 10
			digitsAfterPoint--
		}

		var activatedUser *models.User
		if err := db.Transaction(func(tx *gorm.DB) error {
			user, _, err := applySuccessfulPremiumPayment(tx, userID, "yookassa", paymentID, planID, amountMinor, currency, map[string]any{
				"rawAmount": amountValue,
			})
			if err != nil {
				return err
			}
			activatedUser = user
			return nil
		}); err != nil {
			c.JSON(http.StatusOK, gin.H{"received": true})
			return
		}
		sendPremiumReceiptEmails(activatedUser, plan)
		c.JSON(http.StatusOK, gin.H{"received": true})
	}
}

// GetOwnerRevenue returns payment and premium subscription stats for owner/admin dashboards.
func GetOwnerRevenue(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var totalRevenue int64
		db.Model(&models.Payment{}).Where("status = ?", "succeeded").Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)

		var premiumCount int64
		var freeCount int64
		activePremiumUsersQuery(db).Count(&premiumCount)
		db.Model(&models.User{}).
			Where("plan <> ? OR (plan = ? AND premium_expires_at IS NOT NULL AND premium_expires_at <= ?)", "premium", "premium", time.Now().UTC()).
			Count(&freeCount)

		totalUsers := premiumCount + freeCount
		conversionRate := 0.0
		if totalUsers > 0 {
			conversionRate = float64(premiumCount) / float64(totalUsers) * 100
		}

		since := time.Now().Add(-30 * 24 * time.Hour)
		var paymentsLast30 []models.Payment
		db.Where("status = ? AND created_at > ?", "succeeded", since).Order("created_at DESC").Limit(100).Find(&paymentsLast30)

		last30Revenue := int64(0)
		for _, payment := range paymentsLast30 {
			last30Revenue += payment.Amount
		}

		list := make([]gin.H, 0, len(paymentsLast30))
		for _, payment := range paymentsLast30 {
			list = append(list, gin.H{
				"id":          payment.ID,
				"userId":      payment.UserID,
				"provider":    payment.Provider,
				"amount":      payment.Amount,
				"currency":    payment.Currency,
				"amountLabel": amountLabel(payment.Amount, payment.Currency),
				"createdAt":   payment.CreatedAt.Unix() * 1000,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"totalRevenue":      totalRevenue,
			"last30DaysRevenue": last30Revenue,
			"premiumCount":      premiumCount,
			"freeCount":         freeCount,
			"conversionRate":    conversionRate,
			"recentPayments":    list,
		})
	}
}
