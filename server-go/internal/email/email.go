package email

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"strings"
	"time"
)

// EmailConfig конфигурация для отправки email
type EmailConfig struct {
	Provider   string // gmail, sendgrid, mailgun, resend, smtp
	SMTPHost   string
	SMTPPort   string
	SMTPUser   string
	SMTPPass   string
	FromEmail  string
	FromName   string
	APIKey     string // Для SendGrid, Mailgun, Resend
	APIURL     string // Для Mailgun, Resend
}

// LoadConfig загружает конфигурацию из переменных окружения
func LoadConfig() *EmailConfig {
	provider := getEnv("EMAIL_PROVIDER", "gmail")
	
	config := &EmailConfig{
		Provider:  provider,
		FromEmail: getEnv("EMAIL_FROM", ""),
		FromName:  getEnv("EMAIL_FROM_NAME", "SafeGram"),
	}

	switch provider {
	case "gmail":
		config.SMTPHost = "smtp.gmail.com"
		config.SMTPPort = "587"
		config.SMTPUser = getEnv("GMAIL_USER", "")
		config.SMTPPass = getEnv("GMAIL_APP_PASSWORD", "")
		if config.FromEmail == "" {
			config.FromEmail = config.SMTPUser
		}
	case "sendgrid":
		config.APIKey = getEnv("SENDGRID_API_KEY", "")
		config.APIURL = "https://api.sendgrid.com/v3/mail/send"
		if config.FromEmail == "" {
			config.FromEmail = getEnv("SENDGRID_FROM_EMAIL", "")
		}
	case "mailgun":
		config.APIKey = getEnv("MAILGUN_API_KEY", "")
		domain := getEnv("MAILGUN_DOMAIN", "")
		config.APIURL = fmt.Sprintf("https://api.mailgun.net/v3/%s/messages", domain)
		if config.FromEmail == "" {
			config.FromEmail = fmt.Sprintf("noreply@%s", domain)
		}
	case "resend":
		config.APIKey = getEnv("RESEND_API_KEY", "")
		config.APIURL = "https://api.resend.com/emails"
		if config.FromEmail == "" {
			config.FromEmail = getEnv("RESEND_FROM_EMAIL", "")
		}
	case "smtp":
		config.SMTPHost = getEnv("SMTP_HOST", "smtp.gmail.com")
		config.SMTPPort = getEnv("SMTP_PORT", "587")
		config.SMTPUser = getEnv("SMTP_USER", "")
		config.SMTPPass = getEnv("SMTP_PASSWORD", "")
		if config.FromEmail == "" {
			config.FromEmail = config.SMTPUser
		}
	}

	return config
}

// IsEmailConfigured возвращает true, если в окружении заданы провайдер и учётные данные для отправки писем.
func IsEmailConfigured() (bool, string) {
	config := LoadConfig()
	if config.Provider == "" {
		return false, "EMAIL_PROVIDER не задан"
	}
	if config.SMTPUser == "" && config.APIKey == "" {
		return false, "учётные данные не заданы (GMAIL_USER и GMAIL_APP_PASSWORD для gmail)"
	}
	switch config.Provider {
	case "gmail", "smtp":
		if config.SMTPUser == "" || config.SMTPPass == "" {
			return false, "для gmail/smtp нужны GMAIL_USER и GMAIL_APP_PASSWORD"
		}
	case "sendgrid", "mailgun", "resend":
		if config.APIKey == "" {
			return false, "нужен API ключ для " + config.Provider
		}
	}
	return true, "ok"
}

// SendEmail отправляет email через выбранный провайдер
func SendEmail(to, subject, body string) error {
	config := LoadConfig()

	// Если провайдер не настроен — возвращаем ошибку, чтобы API не врал «письмо отправлено»
	if config.Provider == "" || (config.SMTPUser == "" && config.APIKey == "") {
		return fmt.Errorf("email not configured: set EMAIL_PROVIDER and credentials (e.g. GMAIL_USER, GMAIL_APP_PASSWORD) in .env")
	}

	switch config.Provider {
	case "gmail", "smtp":
		return sendViaSMTP(config, to, subject, body)
	case "sendgrid":
		return sendViaSendGrid(config, to, subject, body)
	case "mailgun":
		return sendViaMailgun(config, to, subject, body)
	case "resend":
		return sendViaResend(config, to, subject, body)
	default:
		return fmt.Errorf("unsupported email provider: %s", config.Provider)
	}
}

const smtpDialTimeout = 15 * time.Second

// sendViaSMTP отправляет email через SMTP с таймаутом подключения (избегаем зависания).
func sendViaSMTP(config *EmailConfig, to, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", config.SMTPHost, config.SMTPPort)
	conn, err := net.DialTimeout("tcp", addr, smtpDialTimeout)
	if err != nil {
		return fmt.Errorf("smtp connect: %w", err)
	}
	defer conn.Close()

	host, _, _ := net.SplitHostPort(addr)
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if config.SMTPPort == "587" || config.SMTPPort == "2587" {
		if err := client.StartTLS(&tls.Config{ServerName: config.SMTPHost}); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	}

	auth := smtp.PlainAuth("", config.SMTPUser, config.SMTPPass, config.SMTPHost)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err := client.Mail(config.FromEmail); err != nil {
		return fmt.Errorf("smtp mail: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	msg := []byte(fmt.Sprintf("From: %s <%s>\r\n", config.FromName, config.FromEmail) +
		fmt.Sprintf("To: %s\r\n", to) +
		fmt.Sprintf("Subject: %s\r\n", subject) +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n" +
		"\r\n" +
		body + "\r\n")
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close: %w", err)
	}
	return nil
}

// sendViaSendGrid отправляет email через SendGrid API
func sendViaSendGrid(config *EmailConfig, to, subject, body string) error {
	type SendGridPayload struct {
		Personalizations []struct {
			To []struct {
				Email string `json:"email"`
			} `json:"to"`
		} `json:"personalizations"`
		From struct {
			Email string `json:"email"`
			Name  string `json:"name"`
		} `json:"from"`
		Subject string `json:"subject"`
		Content []struct {
			Type  string `json:"type"`
			Value string `json:"value"`
		} `json:"content"`
	}

	payload := SendGridPayload{
		Personalizations: []struct {
			To []struct {
				Email string `json:"email"`
			} `json:"to"`
		}{
			{
				To: []struct {
					Email string `json:"email"`
				}{
					{Email: to},
				},
			},
		},
		From: struct {
			Email string `json:"email"`
			Name  string `json:"name"`
		}{
			Email: config.FromEmail,
			Name:  config.FromName,
		},
		Subject: subject,
		Content: []struct {
			Type  string `json:"type"`
			Value string `json:"value"`
		}{
			{
				Type:  "text/html",
				Value: body,
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", config.APIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sendgrid error: %d - %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// sendViaMailgun отправляет email через Mailgun API
func sendViaMailgun(config *EmailConfig, to, subject, body string) error {
	data := url.Values{}
	data.Set("from", fmt.Sprintf("%s <%s>", config.FromName, config.FromEmail))
	data.Set("to", to)
	data.Set("subject", subject)
	data.Set("html", body)

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", config.APIURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth("api", config.APIKey)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("mailgun error: %d - %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// sendViaResend отправляет email через Resend API
func sendViaResend(config *EmailConfig, to, subject, body string) error {
	type ResendPayload struct {
		From    string   `json:"from"`
		To      []string `json:"to"`
		Subject string   `json:"subject"`
		HTML    string   `json:"html"`
	}

	payload := ResendPayload{
		From:    fmt.Sprintf("%s <%s>", config.FromName, config.FromEmail),
		To:      []string{to},
		Subject: subject,
		HTML:    body,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", config.APIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend error: %d - %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// sendHTTPRequest отправляет HTTP запрос
func sendHTTPRequest(apiURL, apiKey, payload string) error {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBufferString(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("email API error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// sendHTTPRequestForm отправляет form-data запрос
func sendHTTPRequestForm(apiURL, apiKey, data string) error {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth("api", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("email API error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendVerificationCode отправляет код подтверждения
func SendVerificationCode(to, code string) error {
	return SendVerificationCodeWithUsername(to, code, "")
}

// SendVerificationCodeWithUsername отправляет код подтверждения с именем пользователя
func SendVerificationCodeWithUsername(to, code, username string) error {
	subject := "Код подтверждения SafeGram"
	data := EmailTemplateData{
		Username:  username,
		Code:      code,
		ExpiresIn: "10 минут",
	}
	htmlBody := TemplateVerificationCode(data)
	return SendEmail(to, subject, htmlBody)
}

// SendWelcomeEmail отправляет приветственное письмо
func SendWelcomeEmail(to, username, appURL string) error {
	subject := "Добро пожаловать в SafeGram! 🎉"
	data := EmailTemplateData{
		Username: username,
		Link:     appURL,
	}
	htmlBody := TemplateWelcome(data)
	return SendEmail(to, subject, htmlBody)
}

// SendLoginNotification отправляет уведомление о входе
func SendLoginNotification(to, username, ip, device string) error {
	subject := "Новый вход в аккаунт SafeGram"
	data := EmailTemplateData{
		Username:  username,
		IP:        ip,
		Device:    device,
		Timestamp: time.Now().Format("02.01.2006 в 15:04"),
	}
	htmlBody := TemplateLoginNotification(data)
	return SendEmail(to, subject, htmlBody)
}

// SendPasswordResetCode отправляет код восстановления пароля
func SendPasswordResetCode(to, username, code string) error {
	subject := "Восстановление пароля SafeGram"
	data := EmailTemplateData{
		Username:  username,
		Code:      code,
		ExpiresIn: "15 минут",
	}
	htmlBody := TemplatePasswordReset(data)
	return SendEmail(to, subject, htmlBody)
}

// SendPasswordChangedNotification отправляет уведомление об изменении пароля
func SendPasswordChangedNotification(to, username, ip string) error {
	subject := "Пароль изменён — SafeGram"
	data := EmailTemplateData{
		Username:  username,
		IP:        ip,
		Timestamp: time.Now().Format("02.01.2006 в 15:04"),
	}
	htmlBody := TemplatePasswordChanged(data)
	return SendEmail(to, subject, htmlBody)
}

// SendNewMessageNotification отправляет уведомление о новом сообщении
func SendNewMessageNotification(to, username, senderName, message, chatName, chatURL string) error {
	subject := fmt.Sprintf("Новое сообщение от %s", senderName)
	data := EmailTemplateData{
		Username:  username,
		SenderName: senderName,
		Message:   message,
		ChatName:  chatName,
		Link:      chatURL,
	}
	htmlBody := TemplateNewMessage(data)
	return SendEmail(to, subject, htmlBody)
}

// SendGroupInvite отправляет приглашение в группу
func SendGroupInvite(to, username, inviterName, groupName, groupURL string) error {
	subject := fmt.Sprintf("Приглашение в группу %s", groupName)
	data := EmailTemplateData{
		Username:    username,
		InviterName: inviterName,
		GroupName:   groupName,
		Link:        groupURL,
	}
	htmlBody := TemplateGroupInvite(data)
	return SendEmail(to, subject, htmlBody)
}

// SendSecurityAlert отправляет уведомление о безопасности
func SendSecurityAlert(to, username, message, settingsURL string) error {
	subject := "⚠️ Уведомление безопасности SafeGram"
	data := EmailTemplateData{
		Username: username,
		Message:  message,
		Link:     settingsURL,
	}
	htmlBody := TemplateSecurityAlert(data)
	return SendEmail(to, subject, htmlBody)
}

// SendAccountLockedNotification отправляет уведомление о блокировке аккаунта
func SendAccountLockedNotification(to, username, reason, supportURL string) error {
	subject := "🔒 Аккаунт временно заблокирован"
	data := EmailTemplateData{
		Username: username,
		Message:  reason,
		Link:     supportURL,
	}
	htmlBody := TemplateAccountLocked(data)
	return SendEmail(to, subject, htmlBody)
}

// SendPremiumActivated отправляет уведомление об активации премиум
func SendPremiumActivated(to, username, appURL string) error {
	subject := "✨ Премиум активирован!"
	data := EmailTemplateData{
		Username: username,
		Link:     appURL,
	}
	htmlBody := TemplatePremiumActivated(data)
	return SendEmail(to, subject, htmlBody)
}

// SendBackupCodes отправляет резервные коды восстановления
func SendBackupCodes(to, username, codes string) error {
	subject := "Резервные коды восстановления SafeGram"
	data := EmailTemplateData{
		Username: username,
		Code:     codes,
	}
	htmlBody := TemplateBackupCode(data)
	return SendEmail(to, subject, htmlBody)
}

// SendAdminMessage отправляет персональное сообщение от администрации
func SendAdminMessage(to, username, message, actionText, actionLink string) error {
	subject := "Сообщение от администрации SafeGram"
	data := EmailTemplateData{
		Username:   username,
		Message:    message,
		ActionText: actionText,
		Link:       actionLink,
	}
	htmlBody := TemplateAdminMessage(data)
	return SendEmail(to, subject, htmlBody)
}

// SendMaintenanceNotification отправляет уведомление о технических работах
func SendMaintenanceNotification(to, username, timestamp, message string) error {
	subject := "⚠️ Плановые технические работы SafeGram"
	data := EmailTemplateData{
		Username:  username,
		Timestamp: timestamp,
		Message:   message,
	}
	htmlBody := TemplateMaintenanceNotification(data)
	return SendEmail(to, subject, htmlBody)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
