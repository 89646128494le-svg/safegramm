package email

import (
	"fmt"
	"time"
)

// EmailTemplateData данные для шаблона
type EmailTemplateData struct {
	Username    string
	Code        string
	Link        string
	Message     string
	ActionText  string
	ExpiresIn   string
	IP          string
	Device      string
	Timestamp   string
	ChatName    string
	SenderName  string
	GroupName   string
	InviterName string
}

// GetBaseTemplate возвращает базовый HTML шаблон
func GetBaseTemplate(title, content string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>%s</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			background: linear-gradient(135deg, #0b1020 0%%, #1a1f35 100%%);
			padding: 20px;
			line-height: 1.6;
		}
		.email-container {
			max-width: 600px;
			margin: 0 auto;
			background: rgba(11, 16, 32, 0.95);
			border-radius: 20px;
			overflow: hidden;
			box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 108, 255, 0.2);
		}
		.email-header {
			background: linear-gradient(135deg, #7c6cff 0%%, #3dd8ff 100%%);
			padding: 40px 30px;
			text-align: center;
		}
		.email-header h1 {
			color: #0a0e1a;
			font-size: 32px;
			font-weight: 800;
			margin: 0;
			text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		}
		.email-body {
			padding: 40px 30px;
			color: #e9ecf5;
		}
		.email-body h2 {
			color: #7c6cff;
			font-size: 24px;
			margin-bottom: 20px;
			font-weight: 700;
		}
		.email-body p {
			margin-bottom: 16px;
			font-size: 16px;
			color: rgba(233, 236, 245, 0.9);
		}
		.code-box {
			background: rgba(124, 108, 255, 0.1);
			border: 2px solid rgba(124, 108, 255, 0.3);
			border-radius: 12px;
			padding: 24px;
			text-align: center;
			margin: 30px 0;
		}
		.code {
			font-size: 42px;
			font-weight: 800;
			color: #7c6cff;
			letter-spacing: 12px;
			font-family: 'Courier New', monospace;
			text-shadow: 0 0 20px rgba(124, 108, 255, 0.5);
		}
		.button {
			display: inline-block;
			padding: 16px 32px;
			background: linear-gradient(135deg, #7c6cff 0%%, #3dd8ff 100%%);
			color: #0a0e1a;
			text-decoration: none;
			border-radius: 12px;
			font-weight: 700;
			font-size: 16px;
			margin: 20px 0;
			box-shadow: 0 12px 40px rgba(124, 108, 255, 0.4);
			transition: transform 0.2s;
		}
		.button:hover {
			transform: translateY(-2px);
		}
		.info-box {
			background: rgba(61, 216, 255, 0.1);
			border-left: 4px solid #3dd8ff;
			padding: 16px;
			margin: 20px 0;
			border-radius: 8px;
		}
		.warning-box {
			background: rgba(255, 193, 7, 0.1);
			border-left: 4px solid #ffc107;
			padding: 16px;
			margin: 20px 0;
			border-radius: 8px;
		}
		.email-footer {
			background: rgba(255, 255, 255, 0.05);
			padding: 30px;
			text-align: center;
			border-top: 1px solid rgba(255, 255, 255, 0.1);
		}
		.email-footer p {
			color: rgba(233, 236, 245, 0.6);
			font-size: 14px;
			margin: 8px 0;
		}
		.divider {
			height: 1px;
			background: linear-gradient(90deg, transparent, rgba(124, 108, 255, 0.5), transparent);
			margin: 30px 0;
		}
		.feature-list {
			list-style: none;
			padding: 0;
		}
		.feature-list li {
			padding: 12px 0;
			padding-left: 30px;
			position: relative;
			color: rgba(233, 236, 245, 0.9);
		}
		.feature-list li:before {
			content: "✓";
			position: absolute;
			left: 0;
			color: #7c6cff;
			font-weight: bold;
			font-size: 18px;
		}
		@media only screen and (max-width: 600px) {
			.email-container {
				border-radius: 0;
			}
			.email-header, .email-body, .email-footer {
				padding: 20px;
			}
			.code {
				font-size: 32px;
				letter-spacing: 8px;
			}
		}
	</style>
</head>
<body>
	<div class="email-container">
		<div class="email-header">
			<h1>SafeGram</h1>
		</div>
		<div class="email-body">
			%s
		</div>
		<div class="email-footer">
			<p><strong>SafeGram</strong> — Безопасный мессенджер нового поколения</p>
			<p>© %d SafeGram. Все права защищены.</p>
			<p style="margin-top: 16px; font-size: 12px; color: rgba(233, 236, 245, 0.4);">
				Это автоматическое письмо. Пожалуйста, не отвечайте на него.
			</p>
		</div>
	</div>
</body>
</html>`, title, content, time.Now().Year())
}

// TemplateVerificationCode шаблон для кода подтверждения
func TemplateVerificationCode(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Подтверждение email</h2>
		<p>Здравствуйте%s!</p>
		<p>Для подтверждения вашего email адреса используйте следующий код:</p>
		<div class="code-box">
			<div class="code">%s</div>
		</div>
		<p>Код действителен в течение <strong>%s</strong>.</p>
		<div class="warning-box">
			<p><strong>⚠️ Важно:</strong> Никому не сообщайте этот код. Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
		</div>
	`,
		func() string {
			if data.Username != "" {
				return ", " + data.Username
			}
			return ""
		}(),
		data.Code,
		func() string {
			if data.ExpiresIn != "" {
				return data.ExpiresIn
			}
			return "10 минут"
		}(),
	)
	return GetBaseTemplate("Подтверждение email", content)
}

// TemplateWelcome шаблон приветственного письма
func TemplateWelcome(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Добро пожаловать в SafeGram! 🎉</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Мы рады приветствовать вас в SafeGram — безопасном мессенджере нового поколения.</p>
		<div class="info-box">
			<p><strong>✨ Что вас ждёт:</strong></p>
			<ul class="feature-list">
				<li>End-to-End шифрование всех сообщений</li>
				<li>Секретные чаты с автоматическим удалением</li>
				<li>Группы и каналы с расширенными настройками</li>
				<li>Голосовые и видеозвонки</li>
				<li>Истории и медиа-галереи</li>
				<li>И многое другое!</li>
			</ul>
		</div>
		<p>Начните общение прямо сейчас — отправьте первое сообщение своим друзьям!</p>
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" class="button">Открыть SafeGram</a>
		</div>
		<div class="divider"></div>
		<p style="font-size: 14px; color: rgba(233, 236, 245, 0.7);">
			Если у вас возникнут вопросы, мы всегда готовы помочь. Просто напишите нам через форму обратной связи в приложении.
		</p>
	`,
		data.Username,
		func() string {
			if data.Link != "" {
				return data.Link
			}
			return "https://safegram.app"
		}(),
	)
	return GetBaseTemplate("Добро пожаловать в SafeGram", content)
}

// TemplateLoginNotification шаблон уведомления о входе
func TemplateLoginNotification(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Новый вход в аккаунт</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Мы обнаружили вход в ваш аккаунт SafeGram.</p>
		<div class="info-box">
			<p><strong>📱 Детали входа:</strong></p>
			<p>Время: <strong>%s</strong></p>
			%s
			%s
		</div>
		<div class="warning-box">
			<p><strong>⚠️ Если это были не вы:</strong></p>
			<p>Немедленно измените пароль и включите двухфакторную аутентификацию в настройках безопасности.</p>
		</div>
		<p>Если это были вы, просто проигнорируйте это письмо.</p>
	`,
		data.Username,
		func() string {
			if data.Timestamp != "" {
				return data.Timestamp
			}
			return time.Now().Format("02.01.2006 в 15:04")
		}(),
		func() string {
			if data.IP != "" {
				return fmt.Sprintf(`<p>IP-адрес: <strong>%s</strong></p>`, data.IP)
			}
			return ""
		}(),
		func() string {
			if data.Device != "" {
				return fmt.Sprintf(`<p>Устройство: <strong>%s</strong></p>`, data.Device)
			}
			return ""
		}(),
	)
	return GetBaseTemplate("Новый вход в аккаунт", content)
}

// TemplatePasswordReset шаблон восстановления пароля
func TemplatePasswordReset(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Восстановление пароля</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Вы запросили восстановление пароля для вашего аккаунта SafeGram.</p>
		<div class="code-box">
			<div class="code">%s</div>
		</div>
		<p>Используйте этот код для сброса пароля. Код действителен в течение <strong>%s</strong>.</p>
		<div class="warning-box">
			<p><strong>⚠️ Важно:</strong></p>
			<p>Если вы не запрашивали восстановление пароля, немедленно свяжитесь с нашей службой поддержки и измените пароль в настройках безопасности.</p>
		</div>
	`,
		data.Username,
		data.Code,
		func() string {
			if data.ExpiresIn != "" {
				return data.ExpiresIn
			}
			return "15 минут"
		}(),
	)
	return GetBaseTemplate("Восстановление пароля", content)
}

// TemplatePasswordChanged шаблон уведомления об изменении пароля
func TemplatePasswordChanged(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Пароль изменён</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Пароль для вашего аккаунта SafeGram был успешно изменён.</p>
		<div class="info-box">
			<p><strong>🕐 Время изменения:</strong> %s</p>
			%s
		</div>
		<div class="warning-box">
			<p><strong>⚠️ Если это были не вы:</strong></p>
			<p>Немедленно восстановите доступ к аккаунту через функцию восстановления пароля и свяжитесь с нашей службой поддержки.</p>
		</div>
	`,
		data.Username,
		func() string {
			if data.Timestamp != "" {
				return data.Timestamp
			}
			return time.Now().Format("02.01.2006 в 15:04")
		}(),
		func() string {
			if data.IP != "" {
				return fmt.Sprintf(`<p><strong>📍 IP-адрес:</strong> %s</p>`, data.IP)
			}
			return ""
		}(),
	)
	return GetBaseTemplate("Пароль изменён", content)
}

// TemplateNewMessage шаблон уведомления о новом сообщении
func TemplateNewMessage(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Новое сообщение</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>У вас новое сообщение от <strong>%s</strong>%s.</p>
		<div class="info-box">
			<p><strong>💬 Сообщение:</strong></p>
			<p style="font-style: italic; color: rgba(233, 236, 245, 0.8);">%s</p>
		</div>
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" class="button">Открыть чат</a>
		</div>
	`,
		data.Username,
		data.SenderName,
		func() string {
			if data.ChatName != "" {
				return " в " + data.ChatName
			}
			return ""
		}(),
		func() string {
			if data.Message != "" {
				if len(data.Message) > 150 {
					return data.Message[:150] + "..."
				}
				return data.Message
			}
			return "Новое сообщение"
		}(),
		func() string {
			if data.Link != "" {
				return data.Link
			}
			return "https://safegram.app/app/chats"
		}(),
	)
	return GetBaseTemplate("Новое сообщение", content)
}

// TemplateGroupInvite шаблон приглашения в группу
func TemplateGroupInvite(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Приглашение в группу</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p><strong>%s</strong> приглашает вас присоединиться к группе <strong>%s</strong>.</p>
		<div class="info-box">
			<p><strong>👥 Группа:</strong> %s</p>
			<p><strong>👤 Пригласил:</strong> %s</p>
		</div>
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" class="button">Присоединиться к группе</a>
		</div>
		<p style="font-size: 14px; color: rgba(233, 236, 245, 0.7);">
			Если вы не хотите присоединяться к этой группе, просто проигнорируйте это письмо.
		</p>
	`,
		data.Username,
		data.InviterName,
		data.GroupName,
		data.GroupName,
		data.InviterName,
		func() string {
			if data.Link != "" {
				return data.Link
			}
			return "https://safegram.app/app/chats"
		}(),
	)
	return GetBaseTemplate("Приглашение в группу", content)
}

// TemplateSecurityAlert шаблон уведомления о безопасности
func TemplateSecurityAlert(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>⚠️ Уведомление безопасности</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>%s</p>
		<div class="warning-box">
			<p><strong>🔒 Рекомендации по безопасности:</strong></p>
			<ul class="feature-list">
				<li>Используйте уникальный и надёжный пароль</li>
				<li>Включите двухфакторную аутентификацию</li>
				<li>Установите PIN-код для дополнительной защиты</li>
				<li>Регулярно проверяйте активные сессии</li>
				<li>Не переходите по подозрительным ссылкам</li>
			</ul>
		</div>
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" class="button">Настройки безопасности</a>
		</div>
	`,
		data.Username,
		func() string {
			if data.Message != "" {
				return data.Message
			}
			return "Мы обнаружили подозрительную активность, связанную с вашим аккаунтом."
		}(),
		func() string {
			if data.Link != "" {
				return data.Link
			}
			return "https://safegram.app/app/settings"
		}(),
	)
	return GetBaseTemplate("Уведомление безопасности", content)
}

// TemplateAccountLocked шаблон уведомления о блокировке аккаунта
func TemplateAccountLocked(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>🔒 Аккаунт временно заблокирован</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Ваш аккаунт SafeGram был временно заблокирован по соображениям безопасности.</p>
		<div class="warning-box">
			<p><strong>📋 Причина блокировки:</strong></p>
			<p>%s</p>
		</div>
		<p>Если вы считаете, что это ошибка, пожалуйста, свяжитесь с нашей службой поддержки.</p>
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" class="button">Связаться с поддержкой</a>
		</div>
	`,
		data.Username,
		func() string {
			if data.Message != "" {
				return data.Message
			}
			return "Обнаружена подозрительная активность"
		}(),
		func() string {
			if data.Link != "" {
				return data.Link
			}
			return "https://safegram.app/feedback"
		}(),
	)
	return GetBaseTemplate("Аккаунт заблокирован", content)
}

// TemplatePremiumActivated шаблон активации премиум
func TemplatePremiumActivated(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>✨ Премиум активирован!</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Поздравляем! Премиум подписка SafeGram успешно активирована.</p>
		<div class="info-box">
			<p><strong>🎁 Теперь вам доступно:</strong></p>
			<ul class="feature-list">
				<li>Неограниченное хранилище для медиа</li>
				<li>Приоритетная поддержка</li>
				<li>Расширенные настройки приватности</li>
				<li>Эксклюзивные темы и стикеры</li>
				<li>Увеличенный лимит участников в группах</li>
				<li>И многое другое!</li>
			</ul>
		</div>
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" class="button">Начать использовать</a>
		</div>
		<p style="font-size: 14px; color: rgba(233, 236, 245, 0.7);">
			Спасибо за выбор SafeGram Premium!
		</p>
	`,
		data.Username,
		func() string {
			if data.Link != "" {
				return data.Link
			}
			return "https://safegram.app/app/chats"
		}(),
	)
	return GetBaseTemplate("Премиум активирован", content)
}

// TemplateBackupCode шаблон для резервных кодов
func TemplateBackupCode(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>Резервные коды восстановления</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Ваши резервные коды восстановления для двухфакторной аутентификации:</p>
		<div class="code-box">
			<div style="font-family: 'Courier New', monospace; font-size: 16px; line-height: 2; color: #e9ecf5;">
				%s
			</div>
		</div>
		<div class="warning-box">
			<p><strong>⚠️ ВАЖНО:</strong></p>
			<p>Сохраните эти коды в безопасном месте. Они понадобятся вам, если вы потеряете доступ к устройству с двухфакторной аутентификацией.</p>
			<p><strong>Каждый код можно использовать только один раз!</strong></p>
		</div>
	`,
		data.Username,
		func() string {
			if data.Code != "" {
				return data.Code
			}
			return "Коды не были сгенерированы"
		}(),
	)
	return GetBaseTemplate("Резервные коды", content)
}

// TemplateAdminMessage шаблон для персонального сообщения от администрации
func TemplateAdminMessage(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>📨 Сообщение от администрации SafeGram</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>У нас есть для вас важное сообщение:</p>
		<div class="info-box" style="background: rgba(124, 108, 255, 0.15); border-left: 4px solid #7c6cff;">
			<div style="font-size: 16px; line-height: 1.8; color: #e9ecf5; white-space: pre-wrap;">%s</div>
		</div>
		%s
		<div class="divider"></div>
		<p style="font-size: 14px; color: rgba(233, 236, 245, 0.7);">
			Если у вас есть вопросы, вы можете связаться с нами через форму обратной связи в приложении.
		</p>
	`,
		data.Username,
		func() string {
			if data.Message != "" {
				return data.Message
			}
			return "Персональное сообщение от администрации"
		}(),
		func() string {
			if data.Link != "" && data.ActionText != "" {
				return fmt.Sprintf(`<div style="text-align: center; margin: 30px 0;">
					<a href="%s" class="button">%s</a>
				</div>`, data.Link, data.ActionText)
			}
			return ""
		}(),
	)
	return GetBaseTemplate("Сообщение от администрации", content)
}

// TemplateMaintenanceNotification шаблон уведомления о технических работах
func TemplateMaintenanceNotification(data EmailTemplateData) string {
	content := fmt.Sprintf(`
		<h2>🔧 Плановые технические работы</h2>
		<p>Здравствуйте, <strong>%s</strong>!</p>
		<p>Уведомляем вас о запланированных технических работах на платформе SafeGram.</p>
		<div class="warning-box">
			<p><strong>⏰ Время проведения работ:</strong></p>
			<p style="font-size: 18px; font-weight: 600;">%s</p>
		</div>
		<div class="info-box">
			<p><strong>ℹ️ Что это значит:</strong></p>
			<p>%s</p>
		</div>
		<p>Мы приносим извинения за временные неудобства и благодарим за понимание.</p>
		<div class="divider"></div>
		<p style="font-size: 14px; color: rgba(233, 236, 245, 0.7);">
			После завершения работ все функции будут восстановлены в полном объёме.
		</p>
	`,
		data.Username,
		func() string {
			if data.Timestamp != "" {
				return data.Timestamp
			}
			return "Время будет объявлено дополнительно"
		}(),
		func() string {
			if data.Message != "" {
				return data.Message
			}
			return "Во время работ доступ к сервису может быть ограничен или временно недоступен."
		}(),
	)
	return GetBaseTemplate("Технические работы", content)
}
