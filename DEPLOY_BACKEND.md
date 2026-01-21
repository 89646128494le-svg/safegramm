# 🚀 Деплой SafeGram Backend

Инструкция по деплою Go backend сервера SafeGram.

## 🌐 Варианты деплоя

### 1. Railway (рекомендуется)

**Плюсы:** Простая настройка, автоматический деплой из GitHub, бесплатный план.

**Шаги:**

1. Зарегистрируйтесь на [Railway.app](https://railway.app)
2. Создайте новый проект
3. Подключите ваш GitHub репозиторий
4. Выберите директорию `server-go`
5. Добавьте переменные окружения:
   ```
   DATABASE_URL=postgres://...
   JWT_SECRET=your-secret-key
   REDIS_URL=redis://...
   WEBHOOK_URL=http://localhost:3000/webhook (опционально)
   PORT=8080
   ```
6. Railway автоматически определит Go проект и задеплоит

### 2. Render

**Шаги:**

1. Зарегистрируйтесь на [Render.com](https://render.com)
2. Создайте новый Web Service
3. Подключите GitHub репозиторий
4. Настройки:
   - **Root Directory:** `server-go`
   - **Build Command:** `go build -o main .`
   - **Start Command:** `./main`
   - **Environment:** Go
5. Добавьте переменные окружения (см. выше)

### 3. DigitalOcean App Platform

**Шаги:**

1. Создайте App на DigitalOcean
2. Подключите GitHub
3. Выберите директорию `server-go`
4. Добавьте PostgreSQL и Redis через Marketplace
5. Настройте переменные окружения

### 4. VPS (Vultr, Hetzner, etc.)

**Шаги:**

1. Создайте VPS (Ubuntu 22.04)
2. Установите Go и PostgreSQL:
   ```bash
   sudo apt update
   sudo apt install -y golang-go postgresql redis-server
   ```
3. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/your-repo/safegramm.git
   cd safegramm/server-go
   ```
4. Создайте `.env` файл:
   ```env
   DATABASE_URL=postgres://safegram:password@localhost:5432/safegram?sslmode=disable
   JWT_SECRET=your-secret-key
   REDIS_URL=localhost:6379
   PORT=8080
   WEBHOOK_URL=http://your-pc-ip:3000/webhook
   ```
5. Соберите и запустите:
   ```bash
   go mod download
   go build -o safegram-server .
   ./safegram-server
   ```

## 📋 Обязательные переменные окружения

```env
# База данных PostgreSQL
DATABASE_URL=postgres://user:password@host:5432/database?sslmode=disable

# JWT Secret (сгенерируйте случайную строку)
JWT_SECRET=your-super-secret-key-here-min-32-chars

# Redis (опционально, но рекомендуется)
REDIS_URL=redis://localhost:6379

# Порт сервера
PORT=8080

# Webhook URL (для получения логов на ПК)
WEBHOOK_URL=http://localhost:3000/webhook

# Имя сервера (для идентификации в логах)
SERVER_NAME=safegram-production

# CORS Origins (разделенные запятыми)
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

## 🗄️ Настройка PostgreSQL

### Railway (автоматически)

Railway автоматически создает PostgreSQL при создании проекта.

### VPS (вручную)

```bash
sudo -u postgres psql
CREATE DATABASE safegram;
CREATE USER safegram WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE safegram TO safegram;
\q
```

## 🔐 Генерация JWT Secret

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## ✅ Проверка деплоя

После деплоя проверьте:

1. Health check:
   ```bash
   curl https://your-backend-url.com/health
   ```

2. Должен вернуть:
   ```json
   {"status":"ok","timestamp":{}}
   ```

3. Проверьте логи в webhook receiver (если настроен)

## 🔗 Настройка CORS

После деплоя backend, обновите `ALLOWED_ORIGINS` с URL вашего frontend на Vercel:

```env
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app.vercel.app
```

Или в коде `main.go` добавьте ваш Vercel URL в список `allowedOrigins`.

## 🚀 Обновление Frontend URL

После деплоя backend, обновите `VITE_API_URL` в Vercel:

1. Зайдите в Vercel Dashboard → Settings → Environment Variables
2. Добавьте/обновите:
   ```
   VITE_API_URL=https://your-backend-url.com
   ```
3. Перезапустите деплой

## 📚 Дополнительно

- Полная документация: `WEBHOOK_SYSTEM.md`
- API документация: `docs/API.md` (если есть)
- Docker деплой: `docker-compose.yml`

## ✅ Готово!

Backend деплоится и готов к работе. Не забудьте:
- ✅ Настроить переменные окружения
- ✅ Обновить `VITE_API_URL` во frontend
- ✅ Настроить webhook receiver для получения логов
