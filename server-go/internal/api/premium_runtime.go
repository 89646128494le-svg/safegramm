package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/email"
	"safegram-server/internal/models"
)

type premiumPlanDefinition struct {
	ID            string
	Plan          string
	Name          string
	Description   string
	Amount        int64
	Currency      string
	PriceLabel    string
	Period        string
	BillingCycle  string
	DurationDays  int
	Features      []string
	Badge         string
	CheckoutReady bool
}

type premiumState struct {
	IsPremium     bool
	Plan          string
	Status        string
	Source        string
	ExpiresAt     *time.Time
	Subscription  *models.Subscription
	CurrentPlanID string
}

func premiumCatalog() []premiumPlanDefinition {
	return []premiumPlanDefinition{
		{
			ID:           "free",
			Plan:         "free",
			Name:         "Free",
			Description:  "Базовый доступ к SafeGram без оплаты.",
			Amount:       0,
			Currency:     "rub",
			PriceLabel:   "0 ₽",
			Period:       "навсегда",
			BillingCycle: "none",
			DurationDays: 0,
			Features: []string{
				"Сообщения и DM",
				"Сквозное шифрование",
				"Базовый поиск",
				"Файлы до 100 МБ",
			},
		},
		{
			ID:            "premium_monthly",
			Plan:          "premium",
			Name:          "Premium Monthly",
			Description:   "Месячная подписка для активного личного использования.",
			Amount:        29900,
			Currency:      "rub",
			PriceLabel:    "299 ₽ / мес",
			Period:        "30 дней",
			BillingCycle:  "monthly",
			DurationDays:  30,
			CheckoutReady: true,
			Badge:         "Рекомендуем",
			Features: []string{
				"Файлы до 2 ГБ",
				"Экспорт истории чатов",
				"Приоритетная поддержка",
				"Расширенный поиск и темы",
				"Все возможности Free",
			},
		},
		{
			ID:            "premium_yearly",
			Plan:          "premium",
			Name:          "Premium Yearly",
			Description:   "Годовая подписка с лучшей ценой за месяц.",
			Amount:        299000,
			Currency:      "rub",
			PriceLabel:    "2 990 ₽ / год",
			Period:        "365 дней",
			BillingCycle:  "yearly",
			DurationDays:  365,
			CheckoutReady: true,
			Badge:         "Выгодно",
			Features: []string{
				"Все возможности Premium Monthly",
				"Экономия на длительном периоде",
				"Единая оплата на год",
			},
		},
	}
}

func premiumPlanByID(planID string) (premiumPlanDefinition, bool) {
	for _, plan := range premiumCatalog() {
		if plan.ID == planID {
			return plan, true
		}
	}
	return premiumPlanDefinition{}, false
}

func premiumCheckoutProvider() string {
	override := strings.ToLower(strings.TrimSpace(os.Getenv("PREMIUM_PROVIDER")))
	switch override {
	case "test", "stripe", "yookassa":
		return override
	}
	if strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")) != "" {
		return "stripe"
	}
	if strings.TrimSpace(os.Getenv("YOOKASSA_SHOP_ID")) != "" && strings.TrimSpace(os.Getenv("YOOKASSA_SECRET_KEY")) != "" {
		return "yookassa"
	}
	return "test"
}

func premiumCheckoutMode() string {
	if premiumCheckoutProvider() == "test" {
		return "instant"
	}
	return "redirect"
}

func premiumAppURL() string {
	candidates := []string{
		os.Getenv("APP_URL"),
		os.Getenv("PUBLIC_APP_URL"),
		os.Getenv("WEB_APP_URL"),
		os.Getenv("FRONTEND_URL"),
		"https://safegram-hazel.vercel.app",
	}
	for _, raw := range candidates {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
			continue
		}
		return strings.TrimRight(raw, "/")
	}
	return "https://safegram-hazel.vercel.app"
}

func premiumBillingURL() string {
	return premiumAppURL() + "/premium-apply"
}

func premiumSuccessURL(planID string) string {
	return premiumBillingURL() + "?status=success&plan=" + url.QueryEscape(planID)
}

func premiumCancelURL(planID string) string {
	return premiumBillingURL() + "?status=cancel&plan=" + url.QueryEscape(planID)
}

func activePremiumUsersQuery(db *gorm.DB) *gorm.DB {
	return db.Model(&models.User{}).
		Where("plan = ?", "premium").
		Where("premium_expires_at IS NULL OR premium_expires_at > ?", time.Now().UTC())
}

func encodeMetadata(meta map[string]any) string {
	if len(meta) == 0 {
		return "{}"
	}
	data, err := json.Marshal(meta)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func amountLabel(amount int64, currency string) string {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		currency = "RUB"
	}
	major := float64(amount) / 100
	switch currency {
	case "RUB":
		return fmt.Sprintf("%.2f ₽", major)
	case "USD":
		return fmt.Sprintf("$%.2f", major)
	case "EUR":
		return fmt.Sprintf("€%.2f", major)
	default:
		return fmt.Sprintf("%.2f %s", major, currency)
	}
}

func syncUserPremiumState(db *gorm.DB, user *models.User) (premiumState, error) {
	state := premiumState{
		IsPremium: false,
		Plan:      "free",
		Status:    "free",
	}
	if user == nil {
		return state, errors.New("user_required")
	}

	now := time.Now().UTC()
	if strings.TrimSpace(user.Plan) == "" {
		user.Plan = "free"
	}

	var sub models.Subscription
	err := db.Where("user_id = ? AND deleted_at IS NULL", user.ID).
		Order("updated_at DESC").
		First(&sub).Error
	if err == nil {
		state.Subscription = &sub
		state.CurrentPlanID = sub.PlanID
		if sub.CurrentPeriodEnd == nil || sub.CurrentPeriodEnd.After(now) {
			state.IsPremium = sub.Plan == "premium"
			if state.IsPremium {
				state.Plan = "premium"
				state.Source = sub.Provider
				state.ExpiresAt = sub.CurrentPeriodEnd
				if sub.CancelAtPeriodEnd {
					state.Status = "canceling"
				} else if sub.Status == "pending" {
					state.Status = "pending"
				} else {
					state.Status = "active"
				}
				updates := map[string]any{
					"plan":               "premium",
					"premium_expires_at": sub.CurrentPeriodEnd,
					"premium_source":     sub.Provider,
					"premium_updated_at": now,
				}
				if user.Plan != "premium" || (user.PremiumExpiresAt == nil && sub.CurrentPeriodEnd != nil) || (user.PremiumExpiresAt != nil && sub.CurrentPeriodEnd != nil && !user.PremiumExpiresAt.Equal(*sub.CurrentPeriodEnd)) || user.PremiumSource != sub.Provider {
					if err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
						return state, err
					}
					user.Plan = "premium"
					user.PremiumExpiresAt = sub.CurrentPeriodEnd
					user.PremiumSource = sub.Provider
					user.PremiumUpdatedAt = &now
				}
				return state, nil
			}
		}
		if sub.Status == "active" || sub.Status == "pending" {
			_ = db.Model(&models.Subscription{}).Where("id = ?", sub.ID).Updates(map[string]any{
				"status": "expired",
			}).Error
		}
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return state, err
	}

	if user.Plan == "premium" {
		state.Plan = "premium"
		state.Source = user.PremiumSource
		state.ExpiresAt = user.PremiumExpiresAt
		if user.PremiumExpiresAt == nil {
			state.IsPremium = true
			state.Status = "manual"
			return state, nil
		}
		if user.PremiumExpiresAt.After(now) {
			state.IsPremium = true
			state.Status = "active"
			return state, nil
		}
		if err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
			"plan":               "free",
			"premium_expires_at": nil,
			"premium_source":     "",
			"premium_updated_at": now,
		}).Error; err != nil {
			return state, err
		}
		user.Plan = "free"
		user.PremiumExpiresAt = nil
		user.PremiumSource = ""
		user.PremiumUpdatedAt = &now
	}
	state.Plan = "free"
	state.Status = "free"
	return state, nil
}

func savePaymentRecord(tx *gorm.DB, userID, provider, externalID, planID string, amount int64, currency, status string, metadata map[string]any) (*models.Payment, error) {
	var payment models.Payment
	err := tx.Where("provider = ? AND external_id = ?", provider, externalID).First(&payment).Error
	if err == nil {
		payment.UserID = userID
		payment.Amount = amount
		payment.Currency = strings.ToLower(currency)
		payment.Plan = planID
		payment.Status = status
		payment.Metadata = encodeMetadata(metadata)
		if err := tx.Save(&payment).Error; err != nil {
			return nil, err
		}
		return &payment, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	payment = models.Payment{
		ID:         uuid.New().String(),
		UserID:     userID,
		Provider:   provider,
		ExternalID: externalID,
		Amount:     amount,
		Currency:   strings.ToLower(currency),
		Plan:       planID,
		Status:     status,
		Metadata:   encodeMetadata(metadata),
	}
	if err := tx.Create(&payment).Error; err != nil {
		return nil, err
	}
	return &payment, nil
}

func activatePremiumPlan(tx *gorm.DB, user *models.User, plan premiumPlanDefinition, provider, externalID string, metadata map[string]any) (*models.Subscription, error) {
	now := time.Now().UTC()
	periodStart := now
	var sub models.Subscription
	err := tx.Where("user_id = ? AND plan = ? AND deleted_at IS NULL", user.ID, "premium").
		Order("updated_at DESC").
		First(&sub).Error
	if err == nil {
		if sub.CurrentPeriodEnd != nil && sub.CurrentPeriodEnd.After(now) {
			periodStart = *sub.CurrentPeriodEnd
		}
		periodEnd := periodStart.AddDate(0, 0, plan.DurationDays)
		sub.PlanID = plan.ID
		sub.Plan = plan.Plan
		sub.Provider = provider
		sub.ExternalID = externalID
		sub.Status = "active"
		sub.BillingCycle = plan.BillingCycle
		sub.Amount = plan.Amount
		sub.Currency = strings.ToLower(plan.Currency)
		sub.CurrentPeriodStart = &now
		sub.CurrentPeriodEnd = &periodEnd
		sub.CancelAtPeriodEnd = false
		sub.CanceledAt = nil
		sub.Metadata = encodeMetadata(metadata)
		if err := tx.Save(&sub).Error; err != nil {
			return nil, err
		}
		if err := tx.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
			"plan":               "premium",
			"premium_expires_at": periodEnd,
			"premium_source":     provider,
			"premium_updated_at": now,
		}).Error; err != nil {
			return nil, err
		}
		user.Plan = "premium"
		user.PremiumExpiresAt = &periodEnd
		user.PremiumSource = provider
		user.PremiumUpdatedAt = &now
		return &sub, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	periodEnd := now.AddDate(0, 0, plan.DurationDays)
	sub = models.Subscription{
		ID:                 uuid.New().String(),
		UserID:             user.ID,
		PlanID:             plan.ID,
		Plan:               plan.Plan,
		Provider:           provider,
		ExternalID:         externalID,
		Status:             "active",
		BillingCycle:       plan.BillingCycle,
		Amount:             plan.Amount,
		Currency:           strings.ToLower(plan.Currency),
		CurrentPeriodStart: &now,
		CurrentPeriodEnd:   &periodEnd,
		Metadata:           encodeMetadata(metadata),
	}
	if err := tx.Create(&sub).Error; err != nil {
		return nil, err
	}
	if err := tx.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
		"plan":               "premium",
		"premium_expires_at": periodEnd,
		"premium_source":     provider,
		"premium_updated_at": now,
	}).Error; err != nil {
		return nil, err
	}
	user.Plan = "premium"
	user.PremiumExpiresAt = &periodEnd
	user.PremiumSource = provider
	user.PremiumUpdatedAt = &now
	return &sub, nil
}

func cancelPremiumOverride(tx *gorm.DB, userID string) error {
	now := time.Now().UTC()
	if err := tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]any{
		"plan":               "free",
		"premium_expires_at": nil,
		"premium_source":     "",
		"premium_updated_at": now,
	}).Error; err != nil {
		return err
	}
	return tx.Model(&models.Subscription{}).
		Where("user_id = ? AND status IN ?", userID, []string{"pending", "active"}).
		Updates(map[string]any{
			"status":               "canceled",
			"cancel_at_period_end": false,
			"canceled_at":          now,
		}).Error
}

func applySuccessfulPremiumPayment(tx *gorm.DB, userID, provider, externalID, planID string, amount int64, currency string, metadata map[string]any) (*models.User, *models.Subscription, error) {
	plan, ok := premiumPlanByID(planID)
	if !ok || plan.Plan != "premium" {
		return nil, nil, errors.New("invalid_plan")
	}
	var user models.User
	if err := tx.First(&user, "id = ?", userID).Error; err != nil {
		return nil, nil, err
	}
	if _, err := savePaymentRecord(tx, userID, provider, externalID, planID, amount, currency, "succeeded", metadata); err != nil {
		return nil, nil, err
	}
	sub, err := activatePremiumPlan(tx, &user, plan, provider, externalID, metadata)
	if err != nil {
		return nil, nil, err
	}
	return &user, sub, nil
}

func sendPremiumReceiptEmails(user *models.User, plan premiumPlanDefinition) {
	if user == nil || user.Email == nil || strings.TrimSpace(*user.Email) == "" {
		return
	}
	emailAddress := strings.TrimSpace(*user.Email)
	username := user.Username
	receiptTime := time.Now().Format("02.01.2006 15:04 MST")
	_ = email.SendPremiumActivated(emailAddress, username, premiumBillingURL())
	_ = email.SendPremiumReceipt(emailAddress, username, plan.Name, amountLabel(plan.Amount, plan.Currency), receiptTime)
}

func createStripeCheckoutSession(user *models.User, plan premiumPlanDefinition, successURL, cancelURL string) (string, string, error) {
	secret := strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY"))
	if secret == "" {
		return "", "", errors.New("stripe_not_configured")
	}
	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("success_url", successURL)
	form.Set("cancel_url", cancelURL)
	form.Set("client_reference_id", user.ID)
	form.Set("metadata[user_id]", user.ID)
	form.Set("metadata[plan_id]", plan.ID)
	form.Set("line_items[0][quantity]", "1")
	form.Set("line_items[0][price_data][currency]", strings.ToLower(plan.Currency))
	form.Set("line_items[0][price_data][unit_amount]", fmt.Sprintf("%d", plan.Amount))
	form.Set("line_items[0][price_data][product_data][name]", "SafeGram Premium")
	form.Set("line_items[0][price_data][product_data][description]", plan.Description)

	req, err := http.NewRequest(http.MethodPost, "https://api.stripe.com/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+secret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var body struct {
		ID    string `json:"id"`
		URL   string `json:"url"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", "", err
	}
	if resp.StatusCode >= 300 {
		if body.Error.Message != "" {
			return "", "", errors.New(body.Error.Message)
		}
		return "", "", fmt.Errorf("stripe_http_%d", resp.StatusCode)
	}
	if body.ID == "" || body.URL == "" {
		return "", "", errors.New("stripe_invalid_response")
	}
	return body.ID, body.URL, nil
}

func createYooKassaCheckout(user *models.User, plan premiumPlanDefinition, successURL string) (string, string, error) {
	shopID := strings.TrimSpace(os.Getenv("YOOKASSA_SHOP_ID"))
	secret := strings.TrimSpace(os.Getenv("YOOKASSA_SECRET_KEY"))
	if shopID == "" || secret == "" {
		return "", "", errors.New("yookassa_not_configured")
	}
	requestBody := map[string]any{
		"amount": map[string]any{
			"value":    fmt.Sprintf("%.2f", float64(plan.Amount)/100),
			"currency": strings.ToUpper(plan.Currency),
		},
		"capture": true,
		"confirmation": map[string]any{
			"type":       "redirect",
			"return_url": successURL,
		},
		"description": "SafeGram Premium",
		"metadata": map[string]any{
			"user_id": user.ID,
			"plan_id": plan.ID,
		},
	}
	payload, err := json.Marshal(requestBody)
	if err != nil {
		return "", "", err
	}
	req, err := http.NewRequest(http.MethodPost, "https://api.yookassa.ru/v3/payments", bytes.NewReader(payload))
	if err != nil {
		return "", "", err
	}
	req.SetBasicAuth(shopID, secret)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotence-Key", uuid.New().String())

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var body struct {
		ID           string `json:"id"`
		Description  string `json:"description"`
		Confirmation struct {
			ConfirmationURL string `json:"confirmation_url"`
		} `json:"confirmation"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", "", err
	}
	if resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("yookassa_http_%d", resp.StatusCode)
	}
	if body.ID == "" || body.Confirmation.ConfirmationURL == "" {
		return "", "", errors.New("yookassa_invalid_response")
	}
	return body.ID, body.Confirmation.ConfirmationURL, nil
}
