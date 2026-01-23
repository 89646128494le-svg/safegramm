# 📧 Email Шаблоны SafeGram

SafeGram использует красивые HTML шаблоны для всех email уведомлений.

## 🎨 Доступные шаблоны

### 1. **Код подтверждения** (`verification`)
Отправляется при регистрации и входе для подтверждения email.

**Использование:**
```go
email.SendVerificationCode(email, code)
// или с именем пользователя
email.SendVerificationCodeWithUsername(email, code, username)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "verification",
    "username": "Иван"
  }'
```

---

### 2. **Приветственное письмо** (`welcome`)
Отправляется после успешной регистрации.

**Использование:**
```go
email.SendWelcomeEmail(email, username, appURL)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "welcome",
    "username": "Иван"
  }'
```

---

### 3. **Уведомление о входе** (`login`)
Отправляется при каждом входе в аккаунт для безопасности.

**Использование:**
```go
email.SendLoginNotification(email, username, ip, device)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "login",
    "username": "Иван"
  }'
```

---

### 4. **Восстановление пароля** (`password_reset`)
Отправляется при запросе восстановления пароля.

**Использование:**
```go
email.SendPasswordResetCode(email, username, code)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "password_reset",
    "username": "Иван"
  }'
```

---

### 5. **Пароль изменён** (`password_changed`)
Отправляется после успешного изменения пароля.

**Использование:**
```go
email.SendPasswordChangedNotification(email, username, ip)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "password_changed",
    "username": "Иван"
  }'
```

---

### 6. **Новое сообщение** (`new_message`)
Отправляется при получении нового сообщения (если включены email уведомления).

**Использование:**
```go
email.SendNewMessageNotification(
    email, username, senderName, message, chatName, chatURL,
)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "new_message",
    "username": "Иван"
  }'
```

---

### 7. **Приглашение в группу** (`group_invite`)
Отправляется при приглашении пользователя в группу.

**Использование:**
```go
email.SendGroupInvite(email, username, inviterName, groupName, groupURL)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "group_invite",
    "username": "Иван"
  }'
```

---

### 8. **Уведомление безопасности** (`security_alert`)
Отправляется при обнаружении подозрительной активности.

**Использование:**
```go
email.SendSecurityAlert(email, username, message, settingsURL)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "security_alert",
    "username": "Иван"
  }'
```

---

### 9. **Аккаунт заблокирован** (`account_locked`)
Отправляется при временной блокировке аккаунта.

**Использование:**
```go
email.SendAccountLockedNotification(email, username, reason, supportURL)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "account_locked",
    "username": "Иван"
  }'
```

---

### 10. **Премиум активирован** (`premium`)
Отправляется при активации премиум подписки.

**Использование:**
```go
email.SendPremiumActivated(email, username, appURL)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "premium",
    "username": "Иван"
  }'
```

---

### 11. **Резервные коды** (`backup_codes`)
Отправляется при генерации резервных кодов для 2FA.

**Использование:**
```go
email.SendBackupCodes(email, username, codes)
```

**Пример:**
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "template": "backup_codes",
    "username": "Иван"
  }'
```

---

## 🧪 Тестирование шаблонов

Для тестирования всех шаблонов используйте endpoint `/api/test/email` (только в development режиме):

```bash
# Установите NODE_ENV=development в .env
NODE_ENV=development

# Отправьте тестовое письмо
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "template": "welcome",
    "username": "Тестовый пользователь"
  }'
```

**Доступные шаблоны для тестирования:**
- `verification` - Код подтверждения
- `welcome` - Приветственное письмо
- `login` - Уведомление о входе
- `password_reset` - Восстановление пароля
- `password_changed` - Пароль изменён
- `new_message` - Новое сообщение
- `group_invite` - Приглашение в группу
- `security_alert` - Уведомление безопасности
- `account_locked` - Аккаунт заблокирован
- `premium` - Премиум активирован
- `backup_codes` - Резервные коды

---

## 🎨 Дизайн шаблонов

Все шаблоны используют единый современный дизайн:
- **Градиентный заголовок** с логотипом SafeGram
- **Тёмная тема** в стиле приложения
- **Адаптивный дизайн** для мобильных устройств
- **Красивые кнопки** с градиентами
- **Информационные блоки** для важных уведомлений
- **Предупреждающие блоки** для безопасности

---

## 📝 Интеграция в код

Все функции находятся в пакете `safegram-server/internal/email`:

```go
import "safegram-server/internal/email"

// Отправка письма
err := email.SendWelcomeEmail("user@example.com", "Иван", "https://safegram.app")
if err != nil {
    // Обработка ошибки
}
```

---

## ⚙️ Настройка

Перед использованием убедитесь, что настроен email провайдер в `.env`:

```env
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=SafeGram
```

Подробнее: `QUICK_EMAIL_SETUP.md`
