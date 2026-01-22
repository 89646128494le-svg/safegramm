# Настройка отправки Email для SafeGram

## 🎯 Быстрый старт

### Вариант 1: Gmail (Самый простой, бесплатно)

1. **Включите двухфакторную аутентификацию** в вашем Google аккаунте:
   - https://myaccount.google.com/security
   - Включите "Двухэтапная аутентификация"

2. **Создайте App Password**:
   - Перейдите: https://myaccount.google.com/apppasswords
   - Выберите "Почта" и "Другое устройство"
   - Введите название: "SafeGram"
   - Скопируйте сгенерированный пароль (16 символов)

3. **Добавьте в `.env`**:
```env
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=SafeGram
```

### Вариант 2: SendGrid (100 emails/день бесплатно)

1. **Зарегистрируйтесь**: https://signup.sendgrid.com/

2. **Создайте API Key**:
   - Settings → API Keys → Create API Key
   - Выберите "Full Access" или "Mail Send"
   - Скопируйте ключ

3. **Добавьте в `.env`**:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
EMAIL_FROM_NAME=SafeGram
```

### Вариант 3: Mailgun (5000 emails/месяц бесплатно)

1. **Зарегистрируйтесь**: https://signup.mailgun.com/

2. **Получите API Key и Domain**:
   - Dashboard → Sending → API Keys
   - Скопируйте API Key
   - Запишите ваш домен (например: `mg.yourdomain.com`)

3. **Добавьте в `.env`**:
```env
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
EMAIL_FROM_NAME=SafeGram
```

### Вариант 4: Resend (100 emails/день бесплатно)

1. **Зарегистрируйтесь**: https://resend.com/signup

2. **Создайте API Key**:
   - API Keys → Create API Key
   - Скопируйте ключ

3. **Добавьте в `.env`**:
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
EMAIL_FROM_NAME=SafeGram
```

### Вариант 5: Любой SMTP сервер

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-password
EMAIL_FROM=your-email@domain.com
EMAIL_FROM_NAME=SafeGram
```

**Популярные SMTP настройки:**

**Yandex:**
- Host: `smtp.yandex.ru`
- Port: `465` (SSL) или `587` (TLS)

**Mail.ru:**
- Host: `smtp.mail.ru`
- Port: `465` (SSL) или `587` (TLS)

**Outlook/Hotmail:**
- Host: `smtp-mail.outlook.com`
- Port: `587`

**Custom SMTP:**
- Используйте настройки вашего хостинга или email провайдера

---

## 📝 Полный пример `.env`

```env
# Email настройки
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=SafeGram

# Или для SendGrid:
# EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
# SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Или для Mailgun:
# EMAIL_PROVIDER=mailgun
# MAILGUN_API_KEY=key-xxxxxxxxxxxxx
# MAILGUN_DOMAIN=mg.yourdomain.com

# Или для Resend:
# EMAIL_PROVIDER=resend
# RESEND_API_KEY=re_xxxxxxxxxxxxx
# RESEND_FROM_EMAIL=noreply@yourdomain.com

# Или для кастомного SMTP:
# EMAIL_PROVIDER=smtp
# SMTP_HOST=smtp.your-provider.com
# SMTP_PORT=587
# SMTP_USER=your-email@domain.com
# SMTP_PASSWORD=your-password
```

---

## 🧪 Тестирование

1. **Перезапустите сервер**:
```bash
cd server-go
go build -o main.exe .
main.exe
```

2. **Отправьте тестовый запрос**:
```bash
curl -X POST http://localhost:8080/api/auth/send-email-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

3. **Проверьте почту** - должно прийти письмо с кодом

---

## ⚠️ Важно

- **Gmail App Password**: Используйте именно App Password, не обычный пароль
- **Rate Limits**: Соблюдайте лимиты провайдеров (Gmail: 500/день, SendGrid: 100/день)
- **Development режим**: В development коды показываются в ответе API для тестирования
- **Production**: В production коды НЕ показываются в ответе

---

## 🔧 Troubleshooting

**Ошибка "535 Authentication failed" (Gmail):**
- Убедитесь, что используете App Password, а не обычный пароль
- Проверьте, что включена двухфакторная аутентификация

**Ошибка "Connection refused":**
- Проверьте SMTP_HOST и SMTP_PORT
- Убедитесь, что порт не заблокирован файрволом

**Письма не приходят:**
- Проверьте папку "Спам"
- Убедитесь, что EMAIL_FROM настроен правильно
- Проверьте логи сервера

---

## 📚 Дополнительно

Для production рекомендуется:
- Использовать Redis для хранения кодов вместо памяти
- Настроить очередь отправки писем
- Добавить retry логику при ошибках отправки
- Мониторинг доставки писем
