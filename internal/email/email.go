package email

import (
	"fmt"
	"net/smtp"
	"os"
	"strings"
)

// Config for SMTP (from env).
type Config struct {
	SMTPHost  string
	SMTPPort  string
	SMTPUser  string
	SMTPPass  string
	FromEmail string
	FromName  string
}

// LoadConfig from env. If not set, SendEmail will only log (emulated).
func LoadConfig() *Config {
	c := &Config{
		SMTPHost:  getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:  getEnv("SMTP_PORT", "587"),
		SMTPUser:  getEnv("SMTP_USER", ""),
		SMTPPass:  getEnv("SMTP_PASSWORD", ""),
		FromEmail: getEnv("EMAIL_FROM", ""),
		FromName:  getEnv("EMAIL_FROM_NAME", "SafeGram"),
	}
	if c.FromEmail == "" {
		c.FromEmail = c.SMTPUser
	}
	return c
}

// SendEmail sends one email. If SMTP not configured, logs and returns nil.
func SendEmail(to, subject, body string) error {
	cfg := LoadConfig()
	if cfg.SMTPUser == "" || cfg.SMTPPass == "" {
		fmt.Printf("[SafeGram EMAIL] To: %s | Subject: %s\n", to, subject)
		return nil
	}
	addr := cfg.SMTPHost + ":" + cfg.SMTPPort
	msg := []byte("From: " + cfg.FromName + " <" + cfg.FromEmail + ">\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" +
		body + "\r\n")
	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
	return smtp.SendMail(addr, auth, cfg.FromEmail, []string{to}, msg)
}

// SendAdminMessage — персональное сообщение от администрации (из archive).
func SendAdminMessage(to, username, message, actionText, actionLink string) error {
	subject := "Сообщение от администрации SafeGram"
	html := TemplateAdminMessage(AdminMessageData{
		Username:   username,
		Message:    message,
		ActionText: actionText,
		ActionLink: actionLink,
	})
	return SendEmail(to, subject, html)
}

// SendMaintenanceNotification — уведомление о техработах (из archive).
func SendMaintenanceNotification(to, username, timestamp, message string) error {
	subject := "Плановые технические работы SafeGram"
	html := TemplateMaintenanceNotification(MaintenanceData{
		Username:  username,
		Timestamp: timestamp,
		Message:   message,
	})
	return SendEmail(to, subject, html)
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return strings.TrimSpace(v)
	}
	return def
}
