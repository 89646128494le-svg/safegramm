# 🚀 Быстрая настройка Email для SafeGram

## ⚡ Самый простой способ - Gmail (5 минут)

### Шаг 1: Создайте App Password в Google

1. Откройте: https://myaccount.google.com/apppasswords
2. Включите двухфакторную аутентификацию (если еще не включена)
3. Выберите "Почта" → "Другое устройство" → "SafeGram"
4. Скопируйте 16-значный пароль (формат: `xxxx xxxx xxxx xxxx`)

### Шаг 2: Добавьте в `server-go/.env`

```env
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=SafeGram
```

### Шаг 3: Перезапустите сервер

```bash
cd server-go
go build -o main.exe .
main.exe
```

**Готово!** Теперь письма будут отправляться на любой email адрес.

---

## 📧 Альтернативные провайдеры

### SendGrid (100 emails/день бесплатно)
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Mailgun (5000 emails/месяц бесплатно)
```env
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
```

### Resend (100 emails/день бесплатно)
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### Yandex Mail
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your-email@yandex.ru
SMTP_PASSWORD=your-password
EMAIL_FROM=your-email@yandex.ru
```

### Mail.ru
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_USER=your-email@mail.ru
SMTP_PASSWORD=your-password
EMAIL_FROM=your-email@mail.ru
```

---

## 🧪 Тест отправки

После настройки отправьте тестовый запрос:

```bash
curl -X POST http://localhost:8080/api/auth/send-email-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Проверьте почту - должно прийти письмо с кодом!

---

## ⚠️ Важно

- **Gmail**: Используйте App Password, НЕ обычный пароль
- **Development**: В dev режиме код показывается в ответе API
- **Production**: В production коды НЕ показываются

Подробная инструкция: `server-go/EMAIL_SETUP.md`
