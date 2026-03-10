package email

import (
	"fmt"
	"html"
	"strconv"
	"strings"
	"time"
)

// EmailTemplateData contains all variables used across email templates.
type EmailTemplateData struct {
	Username            string
	Email               string
	Code                string
	Codes               string
	Link                string
	SecondaryLink       string
	Message             string
	ActionText          string
	SecondaryActionText string
	ExpiresIn           string
	ExpiresAt           string
	IP                  string
	Device              string
	Timestamp           string
	ChatName            string
	SenderName          string
	GroupName           string
	InviterName         string
	Reason              string
	PlanName            string
	Amount              string
	UnreadChatsCount    int
	MessagesCount       int
}

type emailTone string

const (
	toneDefault  emailTone = "default"
	toneSuccess  emailTone = "success"
	toneSecurity emailTone = "security"
	tonePremium  emailTone = "premium"
)

type emailTheme struct {
	OuterBg      string
	PanelBg      string
	PanelBorder  string
	HeroBg       string
	Accent       string
	AccentSoft   string
	BadgeBg      string
	BadgeText    string
	ButtonBg     string
	ButtonShadow string
	TitleColor   string
	TextColor    string
	MutedColor   string
}

type emailLayout struct {
	Tone       emailTone
	Title      string
	Preheader  string
	Eyebrow    string
	Headline   string
	Intro      string
	BodyHTML   string
	CTAHref    string
	CTALabel   string
	FooterNote string
}

func themeForTone(tone emailTone) emailTheme {
	switch tone {
	case toneSuccess:
		return emailTheme{
			OuterBg:      "#07131f",
			PanelBg:      "#081521",
			PanelBorder:  "#1b3b33",
			HeroBg:       "#0d1d1b",
			Accent:       "#39d98a",
			AccentSoft:   "#15372d",
			BadgeBg:      "#10291f",
			BadgeText:    "#7df3b7",
			ButtonBg:     "#39d98a",
			ButtonShadow: "rgba(57, 217, 138, 0.26)",
			TitleColor:   "#f5fbff",
			TextColor:    "#d8e6ef",
			MutedColor:   "#8ea4b5",
		}
	case toneSecurity:
		return emailTheme{
			OuterBg:      "#0a0d17",
			PanelBg:      "#10131d",
			PanelBorder:  "#3c2f17",
			HeroBg:       "#16120c",
			Accent:       "#ffb547",
			AccentSoft:   "#2c2313",
			BadgeBg:      "#231c10",
			BadgeText:    "#ffd897",
			ButtonBg:     "#ffb547",
			ButtonShadow: "rgba(255, 181, 71, 0.26)",
			TitleColor:   "#fff8ee",
			TextColor:    "#eadfcb",
			MutedColor:   "#b7ab97",
		}
	case tonePremium:
		return emailTheme{
			OuterBg:      "#070c18",
			PanelBg:      "#0b1222",
			PanelBorder:  "#244463",
			HeroBg:       "#0d1830",
			Accent:       "#59c2ff",
			AccentSoft:   "#132742",
			BadgeBg:      "#102235",
			BadgeText:    "#afddff",
			ButtonBg:     "#59c2ff",
			ButtonShadow: "rgba(89, 194, 255, 0.28)",
			TitleColor:   "#f3f9ff",
			TextColor:    "#d9e8f8",
			MutedColor:   "#95adc6",
		}
	default:
		return emailTheme{
			OuterBg:      "#07101f",
			PanelBg:      "#0b1220",
			PanelBorder:  "#223049",
			HeroBg:       "#0e1729",
			Accent:       "#6fa8ff",
			AccentSoft:   "#132238",
			BadgeBg:      "#102032",
			BadgeText:    "#bcd7ff",
			ButtonBg:     "#6fa8ff",
			ButtonShadow: "rgba(111, 168, 255, 0.28)",
			TitleColor:   "#f3f8ff",
			TextColor:    "#d9e3f0",
			MutedColor:   "#91a1b6",
		}
	}
}

func renderEmail(layout emailLayout) string {
	theme := themeForTone(layout.Tone)
	preheader := html.EscapeString(valueOr(layout.Preheader, "Сервисное письмо SafeGram"))
	title := html.EscapeString(valueOr(layout.Title, "SafeGram"))
	eyebrow := strings.ToUpper(html.EscapeString(valueOr(layout.Eyebrow, "SAFEGRAM")))
	headline := html.EscapeString(valueOr(layout.Headline, "Уведомление SafeGram"))
	intro := html.EscapeString(layout.Intro)
	footerNote := html.EscapeString(valueOr(layout.FooterNote, "Это автоматическое письмо. Пожалуйста, не отвечайте на него."))

	cta := ""
	if strings.TrimSpace(layout.CTAHref) != "" && strings.TrimSpace(layout.CTALabel) != "" {
		cta = fmt.Sprintf(`
			<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 0 0;">
				<tr>
					<td align="center" style="border-radius: 14px; background:%s; box-shadow: 0 14px 34px %s;">
						<a href="%s" style="display:inline-block; padding: 15px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; font-weight: 700; line-height: 1; color: #06111e; text-decoration: none;">%s</a>
					</td>
				</tr>
			</table>
			<p style="margin: 16px 0 0 0; font-size: 12px; line-height: 1.6; color: %s;">Если кнопка не открывается, используйте ссылку: %s</p>
		`,
			theme.ButtonBg,
			theme.ButtonShadow,
			html.EscapeString(layout.CTAHref),
			html.EscapeString(layout.CTALabel),
			theme.MutedColor,
			html.EscapeString(layout.CTAHref),
		)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<title>%s</title>
</head>
<body style="margin:0; padding:0; background:%s;">
	<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">%s</div>
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="background:%s;">
		<tr>
			<td align="center" style="padding: 28px 12px;">
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="max-width: 640px; background:%s; border: 1px solid %s; border-radius: 28px; overflow: hidden;">
					<tr>
						<td style="padding: 0;">
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%">
								<tr>
									<td style="padding: 18px 24px; background: #070d18; border-bottom: 1px solid rgba(255,255,255,0.06);">
										<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%">
											<tr>
												<td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: 800; color: %s; letter-spacing: 0.3px;">SafeGram</td>
												<td align="right"><span style="display:inline-block; padding: 7px 10px; border-radius: 999px; background:%s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.7px; color:%s;">%s</span></td>
											</tr>
										</table>
									</td>
								</tr>
								<tr>
									<td style="padding: 0 24px 24px 24px; background:%s;">
										<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="margin-top: 24px;">
											<tr>
												<td style="padding: 26px 28px; border-radius: 22px; background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.06);">
													<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color:%s; margin-bottom: 14px;">%s</div>
													<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 34px; line-height: 1.15; font-weight: 800; color:%s; margin: 0 0 14px 0;">%s</div>
													<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 16px; line-height: 1.7; color:%s;">%s</div>
												</td>
											</tr>
										</table>
										<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="margin-top: 20px;">
											<tr>
												<td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.75; color:%s;">%s%s</td>
											</tr>
										</table>
									</td>
								</tr>
								<tr>
									<td style="padding: 22px 24px 28px 24px; background: #080d18; border-top: 1px solid rgba(255,255,255,0.06);">
										<p style="margin:0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.7; color:%s;"><strong style="color:%s;">SafeGram</strong> — secure messenger with a privacy-first approach.</p>
										<p style="margin:0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.7; color:%s;">%s</p>
										<p style="margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.7; color:%s;">© %d SafeGram. Все права защищены.</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`,
		title,
		theme.OuterBg,
		preheader,
		theme.OuterBg,
		theme.PanelBg,
		theme.PanelBorder,
		theme.TitleColor,
		theme.BadgeBg,
		theme.BadgeText,
		eyebrow,
		theme.HeroBg,
		theme.Accent,
		eyebrow,
		theme.TitleColor,
		headline,
		theme.TextColor,
		intro,
		theme.TextColor,
		layout.BodyHTML,
		cta,
		theme.MutedColor,
		theme.TitleColor,
		theme.MutedColor,
		footerNote,
		theme.MutedColor,
		time.Now().Year(),
	)
}

func valueOr(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func greeting(username string) string {
	if strings.TrimSpace(username) == "" {
		return "Здравствуйте."
	}
	return "Здравствуйте, " + html.EscapeString(strings.TrimSpace(username)) + "."
}

func escapeText(value string) string {
	return html.EscapeString(strings.TrimSpace(value))
}

func paragraph(text string) string {
	if strings.TrimSpace(text) == "" {
		return ""
	}
	return fmt.Sprintf(`<p style="margin:0 0 16px 0;">%s</p>`, escapeText(text))
}

func richParagraph(text string) string {
	if strings.TrimSpace(text) == "" {
		return ""
	}
	return fmt.Sprintf(`<p style="margin:0 0 16px 0;">%s</p>`, text)
}

func toneAccent(tone emailTone) string {
	return themeForTone(tone).Accent
}

func cardHTML(tone emailTone, title string, innerHTML string) string {
	theme := themeForTone(tone)
	header := ""
	if strings.TrimSpace(title) != "" {
		header = fmt.Sprintf(`<div style="margin:0 0 12px 0; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color:%s;">%s</div>`, theme.Accent, html.EscapeString(title))
	}
	return fmt.Sprintf(`
		<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="margin: 0 0 18px 0;">
			<tr>
				<td style="padding: 18px 18px 16px 18px; border-radius: 18px; background:%s; border: 1px solid rgba(255,255,255,0.06);">%s%s</td>
			</tr>
		</table>
	`, theme.AccentSoft, header, innerHTML)
}

func noticeCard(tone emailTone, title string, message string) string {
	return cardHTML(tone, title, richParagraph(escapeText(message)))
}

func codeCard(tone emailTone, title, code, caption string) string {
	theme := themeForTone(tone)
	return cardHTML(tone, title, fmt.Sprintf(`
		<div style="margin: 0 0 12px 0; padding: 18px 16px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); text-align:center;">
			<div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; line-height: 1.1; font-weight: 800; letter-spacing: 8px; color:%s;">%s</div>
		</div>
		<p style="margin:0; font-size: 13px; line-height: 1.7; color:%s;">%s</p>
	`, theme.Accent, html.EscapeString(code), theme.MutedColor, html.EscapeString(caption)))
}

func listCard(tone emailTone, title string, items []string) string {
	if len(items) == 0 {
		return ""
	}
	var builder strings.Builder
	builder.WriteString(`<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">`)
	for _, item := range items {
		if strings.TrimSpace(item) == "" {
			continue
		}
		builder.WriteString(fmt.Sprintf(`
			<tr>
				<td valign="top" style="padding: 0 0 10px 0; width: 24px; font-size: 16px; line-height: 1.6; color:%s;">•</td>
				<td valign="top" style="padding: 0 0 10px 0; font-size: 14px; line-height: 1.7; color:#d9e3f0;">%s</td>
			</tr>
		`, toneAccent(tone), html.EscapeString(item)))
	}
	builder.WriteString(`</table>`)
	return cardHTML(tone, title, builder.String())
}

func detailCard(tone emailTone, title string, rows map[string]string) string {
	if len(rows) == 0 {
		return ""
	}
	order := []string{"Устройство", "IP-адрес", "Время", "Новый адрес", "Тариф", "Сумма", "Дата окончания", "Непрочитанные чаты", "Новые сообщения"}
	seen := map[string]bool{}
	var builder strings.Builder
	builder.WriteString(`<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">`)
	appendRow := func(label, value string) {
		if strings.TrimSpace(value) == "" {
			return
		}
		builder.WriteString(fmt.Sprintf(`
			<tr>
				<td valign="top" style="padding: 0 0 10px 0; width: 145px; font-size: 13px; line-height: 1.7; color:#91a1b6;">%s</td>
				<td valign="top" style="padding: 0 0 10px 0; font-size: 14px; line-height: 1.7; color:#f3f8ff; font-weight:600;">%s</td>
			</tr>
		`, html.EscapeString(label), html.EscapeString(value)))
	}
	for _, key := range order {
		if value, ok := rows[key]; ok {
			appendRow(key, value)
			seen[key] = true
		}
	}
	for label, value := range rows {
		if seen[label] {
			continue
		}
		appendRow(label, value)
	}
	builder.WriteString(`</table>`)
	return cardHTML(tone, title, builder.String())
}

func codesCard(tone emailTone, title, caption, codes string) string {
	formatted := strings.ReplaceAll(html.EscapeString(strings.TrimSpace(codes)), "\n", "<br>")
	return cardHTML(tone, title, fmt.Sprintf(`
		<div style="margin: 0 0 12px 0; padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 15px; line-height: 1.9; color:#f3f8ff;">%s</div>
		<p style="margin:0; font-size: 13px; line-height: 1.7; color:#91a1b6;">%s</p>
	`, formatted, html.EscapeString(caption)))
}

func supportBlock(tone emailTone, text string) string {
	if strings.TrimSpace(text) == "" {
		return ""
	}
	return cardHTML(tone, "Если это были не вы", richParagraph(escapeText(text)))
}

func previewText(message string, limit int) string {
	text := strings.TrimSpace(message)
	if text == "" {
		return "Откройте приложение, чтобы посмотреть сообщение безопасно."
	}
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit]) + "…"
}

func countString(value int) string {
	if value <= 0 {
		return "0"
	}
	return strconv.Itoa(value)
}

func appLink(link string) string {
	return valueOr(link, "https://safegram-hazel.vercel.app")
}

func supportLink(link string) string {
	return valueOr(link, "https://safegram-hazel.vercel.app/support")
}

func TemplateVerificationCode(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Вы почти закончили настройку аккаунта SafeGram. Введите код ниже, чтобы подтвердить email и завершить действие."),
		codeCard(toneDefault, "Код подтверждения", valueOr(data.Code, "000000"), "Код действует "+valueOr(data.ExpiresIn, "10 минут")+"."),
		supportBlock(toneSecurity, "Никому не сообщайте этот код. Если запрос сделали не вы, просто проигнорируйте письмо."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneDefault,
		Title:     "Подтвердите email",
		Preheader: "Используйте код, чтобы подтвердить email и завершить действие в SafeGram.",
		Eyebrow:   "Подтверждение email",
		Headline:  "Подтвердите email",
		Intro:     "SafeGram использует короткий одноразовый код для проверки доступа к адресу.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть SafeGram",
	})
}

func TemplateWelcome(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Аккаунт готов к работе. SafeGram уже можно использовать для личной и рабочей переписки."),
		listCard(toneSuccess, "С чего начать", []string{
			"Проверьте настройки защиты входа и резервного восстановления доступа.",
			"Настройте приватность чатов и уведомлений под свой сценарий.",
			"Создайте первый чат и протестируйте безопасный обмен сообщениями.",
		}),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSuccess,
		Title:     "Добро пожаловать в SafeGram",
		Preheader: "Аккаунт настроен. Можно переходить к чатам и параметрам безопасности.",
		Eyebrow:   "Новый аккаунт",
		Headline:  "Добро пожаловать в SafeGram",
		Intro:     "Спокойный старт: сначала безопасность, затем повседневная работа.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть SafeGram",
	})
}

func TemplateLoginNotification(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Мы заметили вход в ваш аккаунт SafeGram с нового устройства или из новой сессии."),
		detailCard(toneSecurity, "Детали входа", map[string]string{
			"Устройство": valueOr(data.Device, "Не определено"),
			"IP-адрес":   valueOr(data.IP, "Не определен"),
			"Время":      valueOr(data.Timestamp, time.Now().Format("02.01.2006 15:04")),
		}),
		supportBlock(toneSecurity, "Если это были не вы, немедленно смените пароль, завершите активные сессии и проверьте настройки безопасности."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Новый вход в SafeGram",
		Preheader: "Проверьте устройство и источник входа в ваш аккаунт.",
		Eyebrow:   "Безопасность",
		Headline:  "Обнаружен новый вход",
		Intro:     "Это сервисное уведомление о доступе к вашему аккаунту.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Проверить безопасность",
	})
}

func TemplatePasswordReset(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Мы получили запрос на восстановление доступа к вашему аккаунту SafeGram."),
		codeCard(toneSecurity, "Код для восстановления", valueOr(data.Code, "000000"), "Код действует "+valueOr(data.ExpiresIn, "15 минут")+"."),
		supportBlock(toneSecurity, "Если вы не запрашивали восстановление, не используйте этот код и проверьте недавние попытки входа."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Восстановление доступа",
		Preheader: "Используйте код, чтобы задать новый пароль и восстановить доступ.",
		Eyebrow:   "Восстановление доступа",
		Headline:  "Сбросьте пароль безопасно",
		Intro:     "Одноразовый код подтверждает, что именно вы запрашиваете восстановление.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть экран восстановления",
	})
}

func TemplatePasswordChanged(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Пароль вашего аккаунта SafeGram был успешно изменен."),
		detailCard(toneSecurity, "Что изменилось", map[string]string{
			"Время":    valueOr(data.Timestamp, time.Now().Format("02.01.2006 15:04")),
			"IP-адрес": valueOr(data.IP, "Не определен"),
		}),
		supportBlock(toneSecurity, "Если это были не вы, восстановите доступ немедленно и свяжитесь с поддержкой."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Пароль изменен",
		Preheader: "Подтверждаем изменение пароля и даем следующий шаг, если это были не вы.",
		Eyebrow:   "Безопасность аккаунта",
		Headline:  "Пароль изменен",
		Intro:     "Это подтверждение критического действия в вашем аккаунте.",
		BodyHTML:  body,
		CTAHref:   supportLink(data.Link),
		CTALabel:  "Проверить безопасность",
	})
}

func TemplateNewMessage(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("В SafeGram появилось новое сообщение."),
		detailCard(toneDefault, "Краткая сводка", map[string]string{
			"Чат": valueOr(data.ChatName, "Личный чат"),
		}),
		cardHTML(toneDefault, "Отправитель", richParagraph(fmt.Sprintf(`<strong style="color:#f3f8ff;">%s</strong><br><span style="color:#91a1b6;">%s</span>`,
			html.EscapeString(valueOr(data.SenderName, "Неизвестный отправитель")),
			html.EscapeString(previewText(data.Message, 100)),
		))),
		noticeCard(toneSecurity, "Приватность", "Для защиты переписки полное содержимое сообщения по email не показывается."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneDefault,
		Title:     "Новое сообщение",
		Preheader: "У вас новое сообщение. Для чтения откройте приложение SafeGram.",
		Eyebrow:   "Активность в чатах",
		Headline:  "У вас новое сообщение",
		Intro:     "Для приватности письмо содержит только безопасный краткий контекст.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть чат",
	})
}

func TemplateGroupInvite(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Вас пригласили в группу SafeGram."),
		detailCard(toneDefault, "Детали приглашения", map[string]string{
			"Группа": valueOr(data.GroupName, "Без названия"),
		}),
		cardHTML(toneDefault, "Кто пригласил", richParagraph(fmt.Sprintf(`<strong style="color:#f3f8ff;">%s</strong>`, html.EscapeString(valueOr(data.InviterName, "Участник SafeGram"))))),
		noticeCard(toneDefault, "Что дальше", "Откройте приложение, чтобы просмотреть подробности и принять решение о вступлении."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneDefault,
		Title:     "Приглашение в группу",
		Preheader: "Вас пригласили в группу. Откройте SafeGram, чтобы посмотреть детали.",
		Eyebrow:   "Приглашение",
		Headline:  "Вас пригласили в группу",
		Intro:     "Принять приглашение можно только внутри приложения SafeGram.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть приглашение",
	})
}

func TemplateSecurityAlert(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		noticeCard(toneSecurity, "Что произошло", valueOr(data.Message, "Мы обнаружили событие безопасности, которое требует вашего внимания.")),
		listCard(toneSecurity, "Рекомендуем сделать сейчас", []string{
			"Проверить активные сессии и недавние входы.",
			"Сменить пароль, если есть сомнения в безопасности.",
			"Обновить настройки защиты входа и резервного восстановления.",
		}),
		supportBlock(toneSecurity, "Если действие выполнили не вы, примите меры сразу. Чем быстрее вы закроете сессии и смените пароль, тем лучше."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Уведомление безопасности",
		Preheader: "Обнаружено важное security-событие. Проверьте аккаунт.",
		Eyebrow:   "Security alert",
		Headline:  "Требуется проверка безопасности",
		Intro:     "Это письмо отправлено автоматически, чтобы вы быстро увидели важное событие в аккаунте.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Проверить безопасность",
	})
}

func TemplateAccountLocked(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Доступ к вашему аккаунту SafeGram был временно ограничен."),
		noticeCard(toneSecurity, "Причина", valueOr(data.Reason, valueOr(data.Message, "Причина не указана."))),
		noticeCard(toneDefault, "Что делать дальше", "Если вы считаете, что ограничение сработало ошибочно, обратитесь в поддержку и укажите email аккаунта."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Доступ временно ограничен",
		Preheader: "Сообщаем о временном ограничении доступа и даем следующий шаг.",
		Eyebrow:   "Ограничение доступа",
		Headline:  "Аккаунт временно ограничен",
		Intro:     "Ограничение применяется, когда система видит риск для безопасности или нарушение правил доступа.",
		BodyHTML:  body,
		CTAHref:   supportLink(data.Link),
		CTALabel:  "Связаться с поддержкой",
	})
}

func TemplatePremiumActivated(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Премиум-доступ для вашего аккаунта SafeGram уже активирован."),
		detailCard(tonePremium, "Детали тарифа", map[string]string{
			"Тариф": valueOr(data.PlanName, "SafeGram Premium"),
		}),
		listCard(tonePremium, "Что теперь доступно", []string{
			"Расширенные сценарии использования и приоритетная поддержка.",
			"Больше контроля над приватностью и дополнительными возможностями аккаунта.",
			"Премиальные функции без необходимости дополнительной настройки.",
		}),
	}, "")
	return renderEmail(emailLayout{
		Tone:      tonePremium,
		Title:     "Премиум активирован",
		Preheader: "Ваш премиум-доступ активен. Все возможности уже доступны в аккаунте.",
		Eyebrow:   "Premium",
		Headline:  "Премиум активирован",
		Intro:     "Тариф применен к вашему аккаунту и готов к использованию.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть SafeGram",
	})
}

func TemplateBackupCode(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Для вашего аккаунта подготовлены резервные коды восстановления."),
		codesCard(toneSecurity, "Recovery codes", "Храните коды отдельно от устройства и не пересылайте их через обычную почту или чаты.", valueOr(data.Codes, data.Code)),
		supportBlock(toneSecurity, "Каждый код используется только один раз. Если вы создаете новый набор, старый перестает действовать."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Резервные коды восстановления",
		Preheader: "Сохраните recovery codes в безопасном месте.",
		Eyebrow:   "Резервный доступ",
		Headline:  "Сохраните резервные коды",
		Intro:     "Эти коды нужны только на случай, если основной способ входа будет недоступен.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть настройки безопасности",
	})
}

func TemplateAdminMessage(data EmailTemplateData) string {
	actionText := valueOr(data.ActionText, "Открыть SafeGram")
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		cardHTML(toneDefault, "Сообщение", richParagraph(strings.ReplaceAll(html.EscapeString(valueOr(data.Message, "У вас новое сообщение от команды SafeGram.")), "\n", "<br>"))),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneDefault,
		Title:     "Сообщение от команды SafeGram",
		Preheader: "Персональное сервисное письмо от команды SafeGram.",
		Eyebrow:   "Команда SafeGram",
		Headline:  "Персональное сообщение",
		Intro:     "Это сервисное письмо отправлено администрацией SafeGram.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  actionText,
	})
}

func TemplateMaintenanceNotification(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Заранее сообщаем о плановых технических работах в SafeGram."),
		detailCard(toneSecurity, "Окно работ", map[string]string{
			"Время": valueOr(data.Timestamp, "Будет объявлено дополнительно"),
		}),
		noticeCard(toneDefault, "Комментарий", valueOr(data.Message, "Во время работ часть функций может работать нестабильно или быть временно недоступна.")),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Плановые технические работы",
		Preheader: "Предупреждаем о технических работах и возможных временных ограничениях сервиса.",
		Eyebrow:   "Service status",
		Headline:  "Плановые технические работы",
		Intro:     "Мы предупреждаем заранее, чтобы вы могли спланировать работу без неожиданностей.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть SafeGram",
	})
}

func TemplateRecruitApproved(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Ваша заявка была одобрена."),
		noticeCard(toneSuccess, "Следующий шаг", "Дальнейшие инструкции будут доступны внутри системы или придут отдельным сервисным сообщением."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSuccess,
		Title:     "Заявка одобрена",
		Preheader: "Подтверждаем одобрение заявки и сообщаем, что будет дальше.",
		Eyebrow:   "Результат заявки",
		Headline:  "Заявка одобрена",
		Intro:     "Спасибо за интерес к SafeGram. Следующий шаг уже подготовлен.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть SafeGram",
	})
}

func TemplateRecruitDeclined(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("По итогам рассмотрения ваша заявка сейчас не была одобрена."),
		noticeCard(toneDefault, "Комментарий", valueOr(data.Reason, valueOr(data.Message, "Причина не указана."))),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneDefault,
		Title:     "Результат рассмотрения заявки",
		Preheader: "Сообщаем результат рассмотрения заявки и, при наличии, комментарий.",
		Eyebrow:   "Результат заявки",
		Headline:  "Статус заявки обновлен",
		Intro:     "Спасибо за уделенное время и интерес к проекту SafeGram.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Перейти на сайт SafeGram",
	})
}

func TemplateEmailChangeVerification(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Вы запросили смену email для аккаунта SafeGram."),
		codeCard(toneSecurity, "Код подтверждения нового email", valueOr(data.Code, "000000"), "Код действует "+valueOr(data.ExpiresIn, "10 минут")+"."),
		supportBlock(toneSecurity, "Если вы не отправляли этот запрос, не используйте код и проверьте настройки безопасности."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Подтвердите новый email",
		Preheader: "Используйте код, чтобы завершить смену email в SafeGram.",
		Eyebrow:   "Смена email",
		Headline:  "Подтвердите новый адрес",
		Intro:     "SafeGram просит отдельное подтверждение для критичных изменений аккаунта.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Подтвердить email",
	})
}

func TemplateEmailChanged(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Контактный email аккаунта SafeGram был изменен."),
		detailCard(toneSecurity, "Подтвержденные изменения", map[string]string{
			"Новый адрес": valueOr(data.Email, "Не указан"),
			"Время":       valueOr(data.Timestamp, time.Now().Format("02.01.2006 15:04")),
		}),
		supportBlock(toneSecurity, "Если это были не вы, срочно восстановите доступ и свяжитесь с поддержкой."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Email изменен",
		Preheader: "Подтверждаем изменение адреса и даем следующий шаг на случай риска.",
		Eyebrow:   "Изменение аккаунта",
		Headline:  "Email обновлен",
		Intro:     "Это подтверждение критического изменения в вашем аккаунте.",
		BodyHTML:  body,
		CTAHref:   supportLink(data.Link),
		CTALabel:  "Проверить аккаунт",
	})
}

func TemplatePremiumReceipt(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Мы получили оплату по подписке SafeGram."),
		detailCard(tonePremium, "Детали платежа", map[string]string{
			"Тариф": valueOr(data.PlanName, "SafeGram Premium"),
			"Сумма": valueOr(data.Amount, "Не указана"),
			"Время": valueOr(data.Timestamp, time.Now().Format("02.01.2006 15:04")),
		}),
		noticeCard(toneDefault, "Нужна проверка?", "Если платеж выглядит неожиданным, проверьте активные подписки и историю действий в аккаунте."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      tonePremium,
		Title:     "Оплата подтверждена",
		Preheader: "Подтверждаем получение платежа по подписке SafeGram.",
		Eyebrow:   "Billing",
		Headline:  "Оплата подтверждена",
		Intro:     "Сохраняем сервисную информацию по платежу для вашего учета.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть биллинг",
	})
}

func TemplatePremiumExpiring(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Премиум-подписка SafeGram скоро закончится."),
		detailCard(tonePremium, "Что истекает", map[string]string{
			"Тариф":          valueOr(data.PlanName, "SafeGram Premium"),
			"Дата окончания": valueOr(data.ExpiresAt, "Не указана"),
		}),
		noticeCard(toneDefault, "Чтобы избежать перерыва", "Проверьте настройки продления заранее, если хотите сохранить доступ к премиум-возможностям без паузы."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      tonePremium,
		Title:     "Подписка скоро закончится",
		Preheader: "Напоминаем о скором окончании премиум-подписки.",
		Eyebrow:   "Premium",
		Headline:  "Срок подписки подходит к концу",
		Intro:     "Это напоминание помогает не потерять доступ к важным функциям в неподходящий момент.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Продлить подписку",
	})
}

func TemplateAccountExportReady(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Запрошенный экспорт данных SafeGram готов."),
		noticeCard(toneDefault, "Срок доступа", "Ссылка на скачивание действует "+valueOr(data.ExpiresIn, "ограниченное время")+". Используйте ее только на доверенном устройстве."),
		supportBlock(toneSecurity, "Если вы не запрашивали экспорт, немедленно проверьте безопасность аккаунта."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneDefault,
		Title:     "Экспорт данных готов",
		Preheader: "Архив данных можно скачать ограниченное время.",
		Eyebrow:   "Экспорт данных",
		Headline:  "Экспорт готов",
		Intro:     "Файл доступен для безопасной загрузки в течение ограниченного периода.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Скачать экспорт",
	})
}

func TemplateAccountDeleted(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("Удаление аккаунта SafeGram завершено."),
		supportBlock(toneSecurity, "Если вы не инициировали удаление, свяжитесь с поддержкой как можно быстрее."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneSecurity,
		Title:     "Аккаунт удален",
		Preheader: "Подтверждаем завершение удаления аккаунта SafeGram.",
		Eyebrow:   "Подтверждение удаления",
		Headline:  "Аккаунт удален",
		Intro:     "Это финальное сервисное уведомление по операции удаления.",
		BodyHTML:  body,
		CTAHref:   supportLink(data.Link),
		CTALabel:  "Связаться с поддержкой",
	})
}

func TemplateUnreadDigest(data EmailTemplateData) string {
	body := strings.Join([]string{
		paragraph(greeting(data.Username)),
		paragraph("За выбранный период в SafeGram появилась новая активность."),
		detailCard(toneDefault, "Краткая сводка", map[string]string{
			"Непрочитанные чаты": countString(data.UnreadChatsCount),
			"Новые сообщения":    countString(data.MessagesCount),
		}),
		noticeCard(toneSecurity, "Приватность", "Для защиты переписки письмо не содержит полного содержания сообщений. Детали доступны только в приложении."),
	}, "")
	return renderEmail(emailLayout{
		Tone:      toneDefault,
		Title:     "Сводка непрочитанной активности",
		Preheader: "Кратко собрали новую активность без раскрытия чувствительных деталей.",
		Eyebrow:   "Digest",
		Headline:  "Что вы пропустили",
		Intro:     "Эта сводка предназначена только для пользователей, которые сами включили email-уведомления по активности.",
		BodyHTML:  body,
		CTAHref:   appLink(data.Link),
		CTALabel:  "Открыть SafeGram",
	})
}
