package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

// SendEmail отправляет email через выбранный провайдер
func SendEmail(to, subject, body string) error {
	config := LoadConfig()

	// Если провайдер не настроен, используем fallback (для разработки)
	if config.Provider == "" || (config.SMTPUser == "" && config.APIKey == "") {
		fmt.Printf("[EMAIL DEBUG] To: %s, Subject: %s\n", to, subject)
		fmt.Printf("[EMAIL DEBUG] Body: %s\n", body)
		return nil
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

// sendViaSMTP отправляет email через SMTP
func sendViaSMTP(config *EmailConfig, to, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", config.SMTPHost, config.SMTPPort)
	
	// Создаем сообщение
	msg := []byte(fmt.Sprintf("From: %s <%s>\r\n", config.FromName, config.FromEmail) +
		fmt.Sprintf("To: %s\r\n", to) +
		fmt.Sprintf("Subject: %s\r\n", subject) +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n" +
		"\r\n" +
		body + "\r\n")

	// Аутентификация
	auth := smtp.PlainAuth("", config.SMTPUser, config.SMTPPass, config.SMTPHost)

	// Отправка (smtp.SendMail автоматически использует TLS для порта 587)
	// Для порта 465 нужен SSL, но smtp.SendMail не поддерживает SSL напрямую
	// В этом случае используйте TLS на порту 587 или настройте клиент с crypto/tls
	return smtp.SendMail(addr, auth, config.FromEmail, []string{to}, msg)
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
	subject := "Код подтверждения SafeGram"
	
	// HTML шаблон письма
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
		.container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
		.code { font-size: 32px; font-weight: bold; color: #7c6cff; text-align: center; letter-spacing: 8px; padding: 20px; background: #f0f0f0; border-radius: 8px; margin: 20px 0; }
		.footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<h1 style="color: #7c6cff;">SafeGram</h1>
		<p>Ваш код подтверждения:</p>
		<div class="code">%s</div>
		<p>Код действителен в течение 10 минут.</p>
		<p>Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
		<div class="footer">
			<p>© 2026 SafeGram. Все права защищены.</p>
		</div>
	</div>
</body>
</html>
`, code)

	return SendEmail(to, subject, htmlBody)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
