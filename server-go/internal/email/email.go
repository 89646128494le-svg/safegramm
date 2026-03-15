package email

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

// EmailConfig конфигурация для отправки email
type EmailConfig struct {
	Provider  string // gmail, sendgrid, mailgun, resend, smtp
	SMTPHost  string
	SMTPPort  string
	SMTPUser  string
	SMTPPass  string
	FromEmail string
	FromName  string
	APIKey    string // Для SendGrid, Mailgun, Resend
	APIURL    string // Для Mailgun, Resend
}

type EmailContent struct {
	HTML string
	Text string
}

var (
	reStripHead      = regexp.MustCompile(`(?is)<(head|style|script)[^>]*>.*?</(head|style|script)>`)
	reBreaks         = regexp.MustCompile(`(?i)<\s*br\s*/?>`)
	reBlockClose     = regexp.MustCompile(`(?i)</(p|div|h1|h2|h3|h4|li|tr|table|section)>`)
	reListOpen       = regexp.MustCompile(`(?i)<li[^>]*>`)
	reTags           = regexp.MustCompile(`(?s)<[^>]+>`)
	reMultipleNL     = regexp.MustCompile(`\n{3,}`)
	reMultipleSpaces = regexp.MustCompile(`[ \t]{2,}`)
)

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
		config.SMTPUser = strings.TrimSpace(getEnv("GMAIL_USER", ""))
		config.SMTPPass = strings.ReplaceAll(strings.TrimSpace(getEnv("GMAIL_APP_PASSWORD", "")), " ", "")
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
		config.SMTPUser = strings.TrimSpace(getEnv("SMTP_USER", ""))
		config.SMTPPass = strings.ReplaceAll(strings.TrimSpace(getEnv("SMTP_PASSWORD", "")), " ", "")
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

// SendEmail sends an email with HTML and an automatically generated plain-text fallback.
func SendEmail(to, subject, body string) error {
	content := EmailContent{
		HTML: body,
		Text: htmlToPlainText(body),
	}
	return sendEmailContent(to, subject, content)
}

func sendEmailContent(to, subject string, content EmailContent) error {
	config := LoadConfig()

	if config.Provider == "" || (config.SMTPUser == "" && config.APIKey == "") {
		err := fmt.Errorf("email not configured: set EMAIL_PROVIDER and credentials (e.g. GMAIL_USER, GMAIL_APP_PASSWORD) in .env")
		log.Printf("[email] SendEmail failed: %v", err)
		return err
	}

	log.Printf("[email] Sending to %s via %s (from %s)", maskEmailForLog(to), config.Provider, config.FromEmail)
	var err error
	switch config.Provider {
	case "gmail", "smtp":
		err = sendViaSMTP(config, to, subject, content)
	case "sendgrid":
		err = sendViaSendGrid(config, to, subject, content)
	case "mailgun":
		err = sendViaMailgun(config, to, subject, content)
	case "resend":
		err = sendViaResend(config, to, subject, content)
	default:
		err = fmt.Errorf("unsupported email provider: %s", config.Provider)
	}
	if err != nil {
		log.Printf("[email] SendEmail failed: %v", err)
		return err
	}
	log.Printf("[email] Sent successfully to %s", maskEmailForLog(to))
	return nil
}

func htmlToPlainText(input string) string {
	plain := reStripHead.ReplaceAllString(input, "")
	plain = reBreaks.ReplaceAllString(plain, "\n")
	plain = reBlockClose.ReplaceAllString(plain, "\n")
	plain = reListOpen.ReplaceAllString(plain, "- ")
	plain = reTags.ReplaceAllString(plain, "")
	plain = html.UnescapeString(plain)
	plain = strings.ReplaceAll(plain, "\r", "")
	lines := strings.Split(plain, "\n")
	for i, line := range lines {
		lines[i] = reMultipleSpaces.ReplaceAllString(strings.TrimSpace(line), " ")
	}
	plain = strings.Join(lines, "\n")
	plain = reMultipleNL.ReplaceAllString(plain, "\n\n")
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return "SafeGram"
	}
	return plain
}

func formatFromAddress(name, address string) string {
	if strings.TrimSpace(name) == "" {
		return address
	}
	return (&mail.Address{Name: name, Address: address}).String()
}

func encodeSubject(subject string) string {
	return mime.QEncoding.Encode("UTF-8", subject)
}

// maskEmailForLog скрывает часть email в логах (безопасность)
func maskEmailForLog(email string) string {
	if email == "" {
		return ""
	}
	at := strings.Index(email, "@")
	if at <= 0 || at >= len(email)-1 {
		return "***"
	}
	return string(email[0]) + "***@" + email[at+1:]
}

func PublicAppURL() string {
	candidates := []string{
		strings.TrimSpace(getEnv("APP_URL", "")),
		strings.TrimSpace(getEnv("PUBLIC_APP_URL", "")),
		strings.TrimSpace(getEnv("WEB_APP_URL", "")),
		strings.TrimSpace(getEnv("FRONTEND_URL", "")),
		"https://safegram.site",
	}
	for _, raw := range candidates {
		if raw == "" {
			continue
		}
		if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
			continue
		}
		return strings.TrimRight(raw, "/")
	}
	return "https://safegram.site"
}

func SupportURL() string {
	return PublicAppURL() + "/support"
}

func SettingsURL() string {
	return PublicAppURL() + "/app/settings"
}

func BillingURL() string {
	return PublicAppURL() + "/app/settings/billing"
}

func ResetPasswordURL() string {
	return PublicAppURL() + "/reset-password"
}

func StatusURL() string {
	return PublicAppURL() + "/status"
}

const smtpDialTimeout = 15 * time.Second

// sendViaSMTP sends an email via SMTP with multipart text/plain and text/html bodies.
func sendViaSMTP(config *EmailConfig, to, subject string, content EmailContent) error {
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
	defer w.Close()

	message, err := buildSMTPMessage(config, to, subject, content)
	if err != nil {
		return err
	}
	if _, err := w.Write(message); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close: %w", err)
	}
	return nil
}

func buildSMTPMessage(config *EmailConfig, to, subject string, content EmailContent) ([]byte, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	body.WriteString(fmt.Sprintf("From: %s\r\n", formatFromAddress(config.FromName, config.FromEmail)))
	body.WriteString(fmt.Sprintf("To: %s\r\n", to))
	body.WriteString(fmt.Sprintf("Subject: %s\r\n", encodeSubject(subject)))
	body.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))
	body.WriteString("MIME-Version: 1.0\r\n")
	body.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=%q\r\n", writer.Boundary()))
	body.WriteString("\r\n")

	plainHeader := textproto.MIMEHeader{}
	plainHeader.Set("Content-Type", "text/plain; charset=UTF-8")
	plainHeader.Set("Content-Transfer-Encoding", "quoted-printable")
	plainPart, err := writer.CreatePart(plainHeader)
	if err != nil {
		return nil, fmt.Errorf("smtp multipart plain part: %w", err)
	}
	plainWriter := quotedprintable.NewWriter(plainPart)
	if _, err := plainWriter.Write([]byte(content.Text)); err != nil {
		return nil, fmt.Errorf("smtp plain write: %w", err)
	}
	if err := plainWriter.Close(); err != nil {
		return nil, fmt.Errorf("smtp plain close: %w", err)
	}

	htmlHeader := textproto.MIMEHeader{}
	htmlHeader.Set("Content-Type", "text/html; charset=UTF-8")
	htmlHeader.Set("Content-Transfer-Encoding", "quoted-printable")
	htmlPart, err := writer.CreatePart(htmlHeader)
	if err != nil {
		return nil, fmt.Errorf("smtp multipart html part: %w", err)
	}
	htmlWriter := quotedprintable.NewWriter(htmlPart)
	if _, err := htmlWriter.Write([]byte(content.HTML)); err != nil {
		return nil, fmt.Errorf("smtp html write: %w", err)
	}
	if err := htmlWriter.Close(); err != nil {
		return nil, fmt.Errorf("smtp html close: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("smtp multipart close: %w", err)
	}
	return body.Bytes(), nil
}

// sendViaSendGrid sends an email via SendGrid API.
func sendViaSendGrid(config *EmailConfig, to, subject string, content EmailContent) error {
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
		}{{To: []struct {
			Email string `json:"email"`
		}{{Email: to}}}},
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
			{Type: "text/plain", Value: content.Text},
			{Type: "text/html", Value: content.HTML},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
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

// sendViaMailgun sends an email via Mailgun API.
func sendViaMailgun(config *EmailConfig, to, subject string, content EmailContent) error {
	data := url.Values{}
	data.Set("from", formatFromAddress(config.FromName, config.FromEmail))
	data.Set("to", to)
	data.Set("subject", subject)
	data.Set("text", content.Text)
	data.Set("html", content.HTML)

	client := &http.Client{Timeout: 10 * time.Second}
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

// sendViaResend sends an email via Resend API.
func sendViaResend(config *EmailConfig, to, subject string, content EmailContent) error {
	type ResendPayload struct {
		From    string   `json:"from"`
		To      []string `json:"to"`
		Subject string   `json:"subject"`
		Text    string   `json:"text"`
		HTML    string   `json:"html"`
	}

	payload := ResendPayload{
		From:    formatFromAddress(config.FromName, config.FromEmail),
		To:      []string{to},
		Subject: subject,
		Text:    content.Text,
		HTML:    content.HTML,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
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

// SendVerificationCodeWithUsername sends a verification code with an optional username.
func SendVerificationCodeWithUsername(to, code, username string) error {
	subject := "Код подтверждения SafeGram"
	data := EmailTemplateData{
		Username:  username,
		Code:      code,
		ExpiresIn: "10 минут",
	}
	return SendEmail(to, subject, TemplateVerificationCode(data))
}

// SendWelcomeEmail sends a welcome email after the first confirmed login.
func SendWelcomeEmail(to, username, appURL string) error {
	subject := "Добро пожаловать в SafeGram"
	data := EmailTemplateData{Username: username, Link: appURL}
	return SendEmail(to, subject, TemplateWelcome(data))
}

// SendLoginNotification sends a security notification about a new login.
func SendLoginNotification(to, username, ip, device string) error {
	subject := "Новый вход в аккаунт SafeGram"
	data := EmailTemplateData{
		Username:  username,
		IP:        ip,
		Device:    device,
		Timestamp: time.Now().Format("02.01.2006 15:04"),
		Link:      SettingsURL(),
	}
	return SendEmail(to, subject, TemplateLoginNotification(data))
}

// SendPasswordResetCode sends a password reset code.
func SendPasswordResetCode(to, username, code string) error {
	subject := "Восстановление пароля SafeGram"
	data := EmailTemplateData{
		Username:  username,
		Code:      code,
		ExpiresIn: "15 минут",
		Link:      ResetPasswordURL(),
	}
	return SendEmail(to, subject, TemplatePasswordReset(data))
}

// SendPasswordChangedNotification confirms that the password was changed.
func SendPasswordChangedNotification(to, username, ip string) error {
	subject := "Пароль SafeGram изменен"
	data := EmailTemplateData{
		Username:  username,
		IP:        ip,
		Timestamp: time.Now().Format("02.01.2006 15:04"),
		Link:      SettingsURL(),
	}
	return SendEmail(to, subject, TemplatePasswordChanged(data))
}

// SendNewMessageNotification sends an email notification about a new message.
func SendNewMessageNotification(to, username, senderName, message, chatName, chatURL string) error {
	subject := fmt.Sprintf("%s написал вам в SafeGram", senderName)
	data := EmailTemplateData{
		Username:   username,
		SenderName: senderName,
		Message:    message,
		ChatName:   chatName,
		Link:       chatURL,
	}
	return SendEmail(to, subject, TemplateNewMessage(data))
}

// SendGroupInvite sends a group invitation email.
func SendGroupInvite(to, username, inviterName, groupName, groupURL string) error {
	subject := fmt.Sprintf("Приглашение в группу %s", groupName)
	data := EmailTemplateData{
		Username:    username,
		InviterName: inviterName,
		GroupName:   groupName,
		Link:        groupURL,
	}
	return SendEmail(to, subject, TemplateGroupInvite(data))
}

// SendSecurityAlert sends a security alert email.
func SendSecurityAlert(to, username, message, settingsURL string) error {
	subject := "Важное уведомление безопасности SafeGram"
	data := EmailTemplateData{
		Username: username,
		Message:  message,
		Link:     settingsURL,
	}
	return SendEmail(to, subject, TemplateSecurityAlert(data))
}

// SendAccountLockedNotification sends a notification that an account was temporarily locked.
func SendAccountLockedNotification(to, username, reason, supportURL string) error {
	subject := "Аккаунт SafeGram временно ограничен"
	data := EmailTemplateData{
		Username: username,
		Reason:   reason,
		Link:     supportURL,
	}
	return SendEmail(to, subject, TemplateAccountLocked(data))
}

// SendPremiumActivated sends a premium activation email.
func SendPremiumActivated(to, username, appURL string) error {
	subject := "SafeGram Premium активирован"
	data := EmailTemplateData{
		Username: username,
		PlanName: "SafeGram Premium",
		Link:     appURL,
	}
	return SendEmail(to, subject, TemplatePremiumActivated(data))
}

// SendBackupCodes sends backup recovery codes.
func SendBackupCodes(to, username, codes string) error {
	subject := "Резервные коды восстановления SafeGram"
	data := EmailTemplateData{
		Username: username,
		Codes:    codes,
		Link:     SettingsURL(),
	}
	return SendEmail(to, subject, TemplateBackupCode(data))
}

// SendBackupCodesRegenerated sends a new set of backup codes after rotation.
func SendBackupCodesRegenerated(to, username, codes string) error {
	subject := "Резервные коды SafeGram обновлены"
	data := EmailTemplateData{
		Username: username,
		Codes:    codes,
		Link:     SettingsURL(),
	}
	return SendEmail(to, subject, TemplateBackupCode(data))
}

// SendAdminMessage sends a custom admin email to a user.
func SendAdminMessage(to, username, message, actionText, actionLink string) error {
	subject := "Сообщение от команды SafeGram"
	data := EmailTemplateData{
		Username:   username,
		Message:    message,
		ActionText: actionText,
		Link:       actionLink,
	}
	return SendEmail(to, subject, TemplateAdminMessage(data))
}

// SendMaintenanceNotification sends a maintenance notification.
func SendMaintenanceNotification(to, username, timestamp, message string) error {
	subject := "Плановые технические работы SafeGram"
	data := EmailTemplateData{
		Username:  username,
		Timestamp: timestamp,
		Message:   message,
		Link:      StatusURL(),
	}
	return SendEmail(to, subject, TemplateMaintenanceNotification(data))
}

// SendRecruitApproved sends an approval email for a recruit application.
func SendRecruitApproved(to, name string) error {
	subject := "Ваша заявка в SafeGram одобрена"
	if name == "" {
		name = "пользователь"
	}
	return SendEmail(to, subject, TemplateRecruitApproved(EmailTemplateData{Username: name, Link: PublicAppURL()}))
}

// SendRecruitDeclined sends a rejection email for a recruit application.
func SendRecruitDeclined(to, name, reason string) error {
	subject := "SafeGram: результат рассмотрения заявки"
	if name == "" {
		name = "пользователь"
	}
	if reason == "" {
		reason = "Причина не указана."
	}
	return SendEmail(to, subject, TemplateRecruitDeclined(EmailTemplateData{Username: name, Reason: reason, Link: PublicAppURL()}))
}

// SendEmailChangeVerification sends a code to confirm a new email address.
func SendEmailChangeVerification(to, username, code string) error {
	subject := "Подтвердите новый email для SafeGram"
	data := EmailTemplateData{
		Username:  username,
		Code:      code,
		ExpiresIn: "10 минут",
		Link:      SettingsURL(),
	}
	return SendEmail(to, subject, TemplateEmailChangeVerification(data))
}

// SendEmailChangedNotification confirms that the email address was changed.
func SendEmailChangedNotification(to, username, newEmail string) error {
	subject := "Email для SafeGram обновлен"
	data := EmailTemplateData{
		Username:  username,
		Email:     newEmail,
		Timestamp: time.Now().Format("02.01.2006 15:04"),
		Link:      SettingsURL(),
	}
	return SendEmail(to, subject, TemplateEmailChanged(data))
}

// SendPremiumReceipt sends a payment confirmation for a premium plan.
func SendPremiumReceipt(to, username, planName, amount, timestamp string) error {
	subject := "Подтверждение оплаты SafeGram"
	data := EmailTemplateData{
		Username:  username,
		PlanName:  planName,
		Amount:    amount,
		Timestamp: timestamp,
		Link:      BillingURL(),
	}
	return SendEmail(to, subject, TemplatePremiumReceipt(data))
}

// SendPremiumExpiring warns that a premium plan is about to expire.
func SendPremiumExpiring(to, username, planName, expiresAt, billingURL string) error {
	subject := "Подписка SafeGram скоро закончится"
	data := EmailTemplateData{
		Username:  username,
		PlanName:  planName,
		ExpiresAt: expiresAt,
		Link:      billingURL,
	}
	return SendEmail(to, subject, TemplatePremiumExpiring(data))
}

// SendAccountExportReady sends a secure export-ready notification.
func SendAccountExportReady(to, username, exportURL, expiresIn string) error {
	subject := "Экспорт данных SafeGram готов"
	data := EmailTemplateData{
		Username:  username,
		ExpiresIn: expiresIn,
		Link:      exportURL,
	}
	return SendEmail(to, subject, TemplateAccountExportReady(data))
}

// SendAccountDeletedConfirmation confirms account deletion.
func SendAccountDeletedConfirmation(to, username, supportURL string) error {
	subject := "Аккаунт SafeGram удален"
	data := EmailTemplateData{
		Username: username,
		Link:     supportURL,
	}
	return SendEmail(to, subject, TemplateAccountDeleted(data))
}

// SendUnreadDigest sends an opt-in digest email for unread activity.
func SendUnreadDigest(to, username string, unreadChatsCount, messagesCount int, appURL string) error {
	subject := "Сводка активности SafeGram"
	data := EmailTemplateData{
		Username:         username,
		UnreadChatsCount: unreadChatsCount,
		MessagesCount:    messagesCount,
		Link:             appURL,
	}
	return SendEmail(to, subject, TemplateUnreadDigest(data))
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
