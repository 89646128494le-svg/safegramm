# 🔗 SafeGram Webhook System

Система логирования и уведомлений для SafeGram сервера.

## 📋 Обзор

Система позволяет получать логи, ошибки и события от SafeGram сервера на ваш ПК в реальном времени через webhook.

## 🏗️ Архитектура

```
SafeGram Server (Go)
    ↓
Logger (internal/logger)
    ↓
Webhook HTTP POST
    ↓
Webhook Receiver (Node.js)
    ↓
Ваш ПК (логи в консоль + файлы)
```

## 📦 Компоненты

### 1. Backend Logger (`server-go/internal/logger/logger.go`)

Система логирования с поддержкой webhook уведомлений:

- ✅ Буферизация логов для эффективной отправки
- ✅ Асинхронная отправка на webhook
- ✅ Разные уровни логирования (info, warning, error, debug)
- ✅ Методанные (service, userId, action, metadata)

**Использование:**

```go
import "safegram-server/internal/logger"

// Инициализация
logger.Init(cfg.WebhookURL, cfg.WebhookURL != "")

// Логирование
logger.Info("User logged in", map[string]interface{}{
    "userId": userId,
    "ip": ip,
})

logger.Error("Database connection failed", err, map[string]interface{}{
    "service": "database",
})

logger.LogAction("message_sent", userId, map[string]interface{}{
    "chatId": chatId,
    "messageId": messageId,
})
```

### 2. Webhook API (`server-go/internal/api/webhook.go`)

API endpoints для управления webhook:

- `GET /api/admin/webhook` - получить текущие настройки
- `POST /api/admin/webhook` - обновить webhook URL
- `POST /api/admin/webhook/test` - отправить тестовое сообщение
- `GET /api/admin/logs` - получить последние логи

### 3. Webhook Receiver (`webhook-receiver/`)

Локальное приложение для получения логов на ПК:

- ✅ Цветной вывод в консоль
- ✅ Сохранение логов в файлы (logs/safegram-YYYY-MM-DD.log)
- ✅ HTTP сервер на порту 3000
- ✅ API для просмотра логов

## 🚀 Установка и настройка

### Шаг 1: Установка Webhook Receiver

```bash
cd webhook-receiver
npm install
```

### Шаг 2: Запуск Webhook Receiver

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
npm start
```

Webhook receiver запустится на `http://localhost:3000`

### Шаг 3: Настройка Webhook в админ-панели

1. Войдите в SafeGram как admin/owner
2. Перейдите в `/app/admin`
3. Откройте вкладку **"Webhook"**
4. Введите URL: `http://localhost:3000/webhook`
5. Нажмите **"Сохранить"**
6. Нажмите **"Тест"** для проверки

### Шаг 4: Настройка для внешнего доступа

Если ваш сервер в облаке, а receiver на локальном ПК:

**Вариант 1: Ngrok (рекомендуется)**

```bash
# Установите ngrok
# https://ngrok.com/download

# Запустите tunnel
ngrok http 3000
```

Вы получите URL вида: `https://xxxx.ngrok.io`
Используйте его в админ-панели: `https://xxxx.ngrok.io/webhook`

**Вариант 2: Порт-форвардинг**

1. Настройте порт-форвардинг на вашем роутере (порт 3000)
2. Используйте ваш внешний IP: `http://your-ip:3000/webhook`

**Вариант 3: Переменная окружения**

Установите `WEBHOOK_URL` в переменных окружения сервера:

```bash
export WEBHOOK_URL=http://your-ip:3000/webhook
```

## 📝 Формат данных

Webhook отправляет POST запрос с JSON:

```json
{
  "logs": [
    {
      "level": "info",
      "message": "User logged in",
      "timestamp": "2024-01-15T10:30:00Z",
      "service": "auth",
      "userId": "user-123",
      "action": "login",
      "metadata": {
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      }
    }
  ],
  "server": "safegram-production"
}
```

## 🔍 Уровни логирования

- **info** - информационные сообщения (синий)
- **warning** - предупреждения (желтый)
- **error** - ошибки (красный)
- **debug** - отладочная информация (серый, только в development)

## 📊 Просмотр логов

### В консоли

Логи автоматически выводятся в консоль webhook receiver с цветовой подсветкой.

### В файлах

Логи сохраняются в `webhook-receiver/logs/safegram-YYYY-MM-DD.log`

### Через API

```bash
# Получить логи за сегодня
curl http://localhost:3000/logs
```

## 🎯 Интеграция в код

Добавьте логирование в ключевые места:

```go
// В auth.go
logger.LogAction("user_login", user.ID, map[string]interface{}{
    "ip": c.ClientIP(),
    "userAgent": c.GetHeader("User-Agent"),
})

// В messages.go
logger.Info("Message sent", map[string]interface{}{
    "userId": userId,
    "chatId": chatId,
    "messageId": messageId,
})

// В error handlers
logger.Error("Failed to process request", err, map[string]interface{}{
    "service": "api",
    "endpoint": c.Request.URL.Path,
    "method": c.Request.Method,
})
```

## 🔧 Переменные окружения

### Backend (server-go)

- `WEBHOOK_URL` - URL webhook receiver (опционально)
- `SERVER_NAME` - Имя сервера (для идентификации в логах)

### Webhook Receiver

- `PORT` - Порт для webhook receiver (по умолчанию 3000)

## ✅ Готово!

Теперь все логи, ошибки и события от SafeGram сервера будут приходить на ваш ПК в реальном времени!
