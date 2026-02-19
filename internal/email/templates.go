package email

import (
	"fmt"
	"html"
)

// AdminMessageData for TemplateAdminMessage.
type AdminMessageData struct {
	Username   string
	Message    string
	ActionText string
	ActionLink string
}

// MaintenanceData for TemplateMaintenanceNotification.
type MaintenanceData struct {
	Username  string
	Timestamp string
	Message   string
}

func baseTemplate(title, content string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>%s</title>
<style>
body{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0f172a; padding: 20px; color: #e2e8f0; line-height: 1.6; }
.container{ max-width: 600px; margin: 0 auto; background: rgba(30,41,59,0.95); border-radius: 16px; overflow: hidden; }
.header{ background: linear-gradient(135deg, #7c3aed, #6366f1); padding: 24px; text-align: center; }
.header h1{ color: #fff; font-size: 24px; margin: 0; }
.body{ padding: 24px; }
.body h2{ color: #a78bfa; font-size: 20px; margin-bottom: 16px; }
.info-box{ background: rgba(139,92,246,0.15); border-left: 4px solid #8b5cf6; padding: 12px; margin: 16px 0; border-radius: 8px; }
.warning-box{ background: rgba(251,191,36,0.1); border-left: 4px solid #fbbf24; padding: 12px; margin: 16px 0; border-radius: 8px; }
.btn{ display: inline-block; padding: 12px 24px; background: #8b5cf6; color: #fff; text-decoration: none; border-radius: 10px; font-weight: bold; margin: 16px 0; }
.footer{ padding: 16px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid rgba(148,163,184,0.2); }
</style></head>
<body><div class="container"><div class="header"><h1>SafeGram</h1></div><div class="body">%s</div><div class="footer">SafeGram — защищённый мессенджер</div></div></body></html>`,
		html.EscapeString(title), content)
}

// TemplateAdminMessage — шаблон письма от администрации (из archive).
func TemplateAdminMessage(d AdminMessageData) string {
	msg := d.Message
	if msg == "" {
		msg = "Персональное сообщение от администрации"
	}
	btn := ""
	if d.ActionLink != "" && d.ActionText != "" {
		btn = fmt.Sprintf(`<p style="text-align:center; margin:20px 0;"><a href="%s" class="btn">%s</a></p>`,
			html.EscapeString(d.ActionLink), html.EscapeString(d.ActionText))
	}
	content := fmt.Sprintf(`<h2>Сообщение от администрации</h2><p>Здравствуйте, <strong>%s</strong>!</p><p>У нас для вас важное сообщение:</p><div class="info-box">%s</div>%s<p style="font-size:14px; color:#94a3b8;">Вопросы — через форму обратной связи в приложении.</p>`,
		html.EscapeString(d.Username), stringsToHTML(msg), btn)
	return baseTemplate("Сообщение от администрации", content)
}

// TemplateMaintenanceNotification — шаблон уведомления о техработах (из archive).
func TemplateMaintenanceNotification(d MaintenanceData) string {
	ts := d.Timestamp
	if ts == "" {
		ts = "Время будет объявлено дополнительно"
	}
	msg := d.Message
	if msg == "" {
		msg = "Во время работ доступ может быть ограничен."
	}
	content := fmt.Sprintf(`<h2>Плановые технические работы</h2><p>Здравствуйте, <strong>%s</strong>!</p><p>Уведомляем о запланированных работах на SafeGram.</p><div class="warning-box"><p><strong>Время:</strong></p><p>%s</p></div><div class="info-box"><p>%s</p></div><p>Приносим извинения за неудобства.</p>`,
		html.EscapeString(d.Username), html.EscapeString(ts), html.EscapeString(msg))
	return baseTemplate("Технические работы", content)
}

func stringsToHTML(s string) string {
	return "<div style=\"white-space:pre-wrap;\">" + html.EscapeString(s) + "</div>"
}
