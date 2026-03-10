package api

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

func serializePremiumPlan(plan premiumPlanDefinition) gin.H {
	return gin.H{
		"id":            plan.ID,
		"name":          plan.Name,
		"plan":          plan.Plan,
		"description":   plan.Description,
		"price":         plan.Amount,
		"priceLabel":    plan.PriceLabel,
		"currency":      strings.ToLower(plan.Currency),
		"period":        plan.Period,
		"billingCycle":  plan.BillingCycle,
		"durationDays":  plan.DurationDays,
		"features":      plan.Features,
		"badge":         plan.Badge,
		"checkoutReady": plan.CheckoutReady,
	}
}

func serializeSubscription(sub *models.Subscription) gin.H {
	if sub == nil {
		return nil
	}
	return gin.H{
		"id":                 sub.ID,
		"planId":             sub.PlanID,
		"plan":               sub.Plan,
		"provider":           sub.Provider,
		"status":             sub.Status,
		"billingCycle":       sub.BillingCycle,
		"amount":             sub.Amount,
		"currency":           sub.Currency,
		"currentPeriodStart": sub.CurrentPeriodStart,
		"currentPeriodEnd":   sub.CurrentPeriodEnd,
		"cancelAtPeriodEnd":  sub.CancelAtPeriodEnd,
		"canceledAt":         sub.CanceledAt,
		"updatedAt":          sub.UpdatedAt,
	}
}

func validRedirectURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}
	if u.Host == "" {
		return ""
	}
	return raw
}

// GetPremiumInfo returns normalized premium state for the current user.
func GetPremiumInfo(db *gorm.DB) gin.HandlerFunc {
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

		state, err := syncUserPremiumState(db, &user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		currentPlanID := state.CurrentPlanID
		if currentPlanID == "" && state.IsPremium {
			currentPlanID = "premium_monthly"
		}
		if currentPlanID == "" {
			currentPlanID = "free"
		}
		currentPlan, hasPlan := premiumPlanByID(currentPlanID)
		if !hasPlan {
			currentPlan, _ = premiumPlanByID("free")
		}

		c.JSON(http.StatusOK, gin.H{
			"isPremium":        state.IsPremium,
			"plan":             state.Plan,
			"premiumStatus":    state.Status,
			"premiumSource":    user.PremiumSource,
			"premiumExpiresAt": user.PremiumExpiresAt,
			"provider":         premiumCheckoutProvider(),
			"checkoutMode":     premiumCheckoutMode(),
			"currentPlanId":    currentPlanID,
			"currentPlan":      serializePremiumPlan(currentPlan),
			"subscription":     serializeSubscription(state.Subscription),
			"features":         currentPlan.Features,
			"billingUrl":       premiumBillingURL(),
		})
	}
}

// CheckoutPremium creates a real redirect checkout or instant test activation.
func CheckoutPremium(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var req struct {
			PlanID     string `json:"planId"`
			SuccessURL string `json:"successUrl"`
			CancelURL  string `json:"cancelUrl"`
		}
		if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		planID := strings.TrimSpace(req.PlanID)
		if planID == "" {
			planID = "premium_monthly"
		}
		plan, ok := premiumPlanByID(planID)
		if !ok || !plan.CheckoutReady {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_plan"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if _, err := syncUserPremiumState(db, &user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		successURL := validRedirectURL(req.SuccessURL)
		cancelURL := validRedirectURL(req.CancelURL)
		if successURL == "" {
			successURL = premiumSuccessURL(plan.ID)
		}
		if cancelURL == "" {
			cancelURL = premiumCancelURL(plan.ID)
		}

		provider := premiumCheckoutProvider()
		if provider == "test" {
			var activatedUser *models.User
			if err := db.Transaction(func(tx *gorm.DB) error {
				userCopy, _, err := applySuccessfulPremiumPayment(
					tx,
					user.ID,
					"test",
					"test_"+uuid.New().String(),
					plan.ID,
					plan.Amount,
					plan.Currency,
					map[string]any{
						"mode":       "instant",
						"successUrl": successURL,
					},
				)
				if err != nil {
					return err
				}
				activatedUser = userCopy
				return nil
			}); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
				return
			}
			sendPremiumReceiptEmails(activatedUser, plan)
			c.JSON(http.StatusOK, gin.H{
				"ok":               true,
				"activated":        true,
				"provider":         "test",
				"checkoutMode":     "instant",
				"planId":           plan.ID,
				"premiumExpiresAt": activatedUser.PremiumExpiresAt,
				"message":          "Premium activated in test mode",
			})
			return
		}

		var externalID, checkoutURL string
		var err error
		switch provider {
		case "stripe":
			externalID, checkoutURL, err = createStripeCheckoutSession(&user, plan, successURL, cancelURL)
		case "yookassa":
			externalID, checkoutURL, err = createYooKassaCheckout(&user, plan, successURL)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_provider"})
			return
		}
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "checkout_unavailable", "message": err.Error()})
			return
		}

		if err := db.Transaction(func(tx *gorm.DB) error {
			_, err := savePaymentRecord(tx, user.ID, provider, externalID, plan.ID, plan.Amount, plan.Currency, "pending", map[string]any{
				"checkoutUrl": checkoutURL,
			})
			return err
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok":           true,
			"activated":    false,
			"provider":     provider,
			"checkoutMode": "redirect",
			"planId":       plan.ID,
			"checkoutUrl":  checkoutURL,
			"externalId":   externalID,
		})
	}
}

// GetPremiumHistory returns payment history and latest subscription state.
func GetPremiumHistory(db *gorm.DB) gin.HandlerFunc {
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
		state, err := syncUserPremiumState(db, &user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var payments []models.Payment
		if err := db.Where("user_id = ?", user.ID).Order("created_at DESC").Limit(50).Find(&payments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		items := make([]gin.H, 0, len(payments))
		for _, payment := range payments {
			items = append(items, gin.H{
				"id":          payment.ID,
				"provider":    payment.Provider,
				"externalId":  payment.ExternalID,
				"amount":      payment.Amount,
				"amountLabel": amountLabel(payment.Amount, payment.Currency),
				"currency":    payment.Currency,
				"planId":      payment.Plan,
				"status":      payment.Status,
				"createdAt":   payment.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"isPremium":     state.IsPremium,
			"plan":          state.Plan,
			"premiumStatus": state.Status,
			"subscription":  serializeSubscription(state.Subscription),
			"payments":      items,
		})
	}
}

// CancelPremiumRenewal marks the current subscription to stop at period end.
func CancelPremiumRenewal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		now := time.Now().UTC()
		if err := db.Model(&models.Subscription{}).
			Where("user_id = ? AND status = ?", userIDStr, "active").
			Updates(map[string]any{
				"cancel_at_period_end": true,
				"canceled_at":          now,
			}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "cancelAtPeriodEnd": true})
	}
}

// ResumePremiumRenewal clears the local cancel flag.
func ResumePremiumRenewal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		if err := db.Model(&models.Subscription{}).
			Where("user_id = ? AND status = ?", userIDStr, "active").
			Updates(map[string]any{
				"cancel_at_period_end": false,
				"canceled_at":          nil,
			}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "cancelAtPeriodEnd": false})
	}
}

// SubscribePremium activates premium manually for the specified user (owner-only).
func SubscribePremium(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var req struct {
			Duration int `json:"duration"`
		}

		if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}
		if req.Duration <= 0 {
			req.Duration = 30
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		plan, _ := premiumPlanByID("premium_monthly")
		plan.DurationDays = req.Duration
		plan.PriceLabel = "Manual activation"
		if err := db.Transaction(func(tx *gorm.DB) error {
			_, err := activatePremiumPlan(tx, &user, plan, "admin", "admin_"+uuid.New().String(), map[string]any{
				"manual":   true,
				"duration": req.Duration,
			})
			return err
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		sendPremiumReceiptEmails(&user, plan)
		c.JSON(http.StatusOK, gin.H{
			"ok":               true,
			"plan":             "premium",
			"duration":         req.Duration,
			"premiumExpiresAt": user.PremiumExpiresAt,
		})
	}
}

// CheckPremiumFeature blocks access for free users.
func CheckPremiumFeature(db *gorm.DB, feature string) gin.HandlerFunc {
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

		state, err := syncUserPremiumState(db, &user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			c.Abort()
			return
		}
		if !state.IsPremium {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "premium_required",
				"feature": feature,
				"message": "Эта функция доступна только для Premium пользователей",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// GetPremiumStats returns current premium/free split (owner-only).
func GetPremiumStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var premiumCount int64
		var freeCount int64
		activePremiumUsersQuery(db).Count(&premiumCount)
		db.Model(&models.User{}).Where("plan <> ? OR (plan = ? AND premium_expires_at IS NOT NULL AND premium_expires_at <= ?)", "premium", "premium", time.Now().UTC()).Count(&freeCount)

		c.JSON(http.StatusOK, gin.H{
			"premium": premiumCount,
			"free":    freeCount,
			"total":   premiumCount + freeCount,
		})
	}
}

// GetPlans returns public billing catalog.
func GetPlans(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		items := make([]gin.H, 0, len(premiumCatalog()))
		for _, plan := range premiumCatalog() {
			items = append(items, serializePremiumPlan(plan))
		}
		c.JSON(http.StatusOK, gin.H{
			"plans":        items,
			"provider":     premiumCheckoutProvider(),
			"checkoutMode": premiumCheckoutMode(),
			"billingUrl":   premiumBillingURL(),
		})
	}
}
