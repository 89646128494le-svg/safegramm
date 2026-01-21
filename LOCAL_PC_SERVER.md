# 💻 Локальный ПК как сервер SafeGram

Настройка backend на вашем Windows ПК с публичным доступом через ngrok.

## 🎯 Что получите

- ✅ Backend работает на вашем ПК
- ✅ Публичный доступ через ngrok (бесплатно)
- ✅ Автозапуск при включении ПК
- ✅ Полный контроль
- ✅ Бесплатно навсегда

**Минусы:**
- ⚠️ ПК должен быть включен 24/7
- ⚠️ Зависит от вашего интернета

---

## 📋 Шаг 1: Установка PostgreSQL

### Вариант A: Через Docker (РЕКОМЕНДУЕТСЯ)

```powershell
# Убедитесь что Docker Desktop запущен
# Установите PostgreSQL через Docker
docker run -d `
  --name safegram-postgres `
  -e POSTGRES_USER=safegram `
  -e POSTGRES_PASSWORD=safegram `
  -e POSTGRES_DB=safegram `
  -p 5432:5432 `
  -v safegram-data:/var/lib/postgresql/data `
  postgres:16-alpine
```

### Вариант B: Прямая установка

1. Скачайте PostgreSQL: https://www.postgresql.org/download/windows/
2. Установите (пароль для postgres: `safegram`)
3. Создайте базу:
   ```sql
   CREATE DATABASE safegram;
   CREATE USER safegram WITH PASSWORD 'safegram';
   GRANT ALL PRIVILEGES ON DATABASE safegram TO safegram;
   ```

---

## 📋 Шаг 2: Установка Redis (опционально, но рекомендуется)

```powershell
# Через Docker
docker run -d `
  --name safegram-redis `
  -p 6379:6379 `
  -v safegram-redis-data:/data `
  redis:7-alpine
```

---

## 📋 Шаг 3: Установка Go

1. Скачайте: https://go.dev/dl/go1.21.5.windows-amd64.msi
2. Установите (по умолчанию в `C:\Program Files\Go`)
3. Проверьте в PowerShell:
   ```powershell
   go version
   ```

---

## ⚙️ Шаг 4: Настройка Backend

```powershell
# Перейдите в папку проекта
cd "C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\server-go"

# Создайте .env файл
@"
DATABASE_URL=postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable
JWT_SECRET=сгенерируйте-случайную-строку-32-символа
PORT=8080
WEBHOOK_URL=http://localhost:3000/webhook
NODE_ENV=production
REDIS_URL=localhost:6379
"@ | Out-File -FilePath .env -Encoding UTF8
```

**Генерация JWT_SECRET:**
```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

## 🚀 Шаг 5: Запуск Backend

```powershell
# Установите зависимости
go mod download

# Соберите
go build -o main.exe .

# Запустите
.\main.exe
```

**Проверьте:** http://localhost:8080/health

---

## 🌐 Шаг 6: Настройка ngrok (публичный доступ)

### Установка ngrok:

1. Скачайте: https://ngrok.com/download
2. Распакуйте в `C:\ngrok\`
3. Зарегистрируйтесь на https://ngrok.com (бесплатно)
4. Получите authtoken в dashboard
5. Авторизуйтесь:
   ```powershell
   C:\ngrok\ngrok.exe authtoken ваш-токен
   ```

### Запуск туннеля:

```powershell
# Запустите ngrok в отдельном окне PowerShell
C:\ngrok\ngrok.exe http 8080
```

**Скопируйте URL** (например: `https://abc123.ngrok-free.app`)

Это ваш публичный URL для backend!

---

## 🔄 Шаг 7: Автозапуск при включении ПК

### Вариант A: Task Scheduler (Windows)

Создайте скрипт автозапуска:

**Создайте `start-safegram.bat` в `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\`:**

```batch
@echo off
cd /d "C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\server-go"

REM Запуск PostgreSQL через Docker (если используется)
docker start safegram-postgres 2>nul
docker start safegram-redis 2>nul

REM Запуск backend
start "SafeGram Backend" cmd /k "main.exe"

REM Запуск ngrok (опционально, в отдельном окне)
REM start "SafeGram ngrok" cmd /k "C:\ngrok\ngrok.exe http 8080"

timeout /t 3 >nul
```

**Настройка автозапуска:**

1. Нажмите `Win + R`
2. Введите `taskschd.msc`
3. Create Basic Task
4. Name: `SafeGram Backend`
5. Trigger: When I log on
6. Action: Start a program
7. Program: `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\start-safegram.bat`
8. Finish

### Вариант B: NSSM (Windows Service)

Сделает backend как Windows сервис:

1. Скачайте NSSM: https://nssm.cc/download
2. Распакуйте `nssm.exe` в `C:\nssm\`
3. Установите сервис:
   ```powershell
   C:\nssm\nssm.exe install SafeGramBackend
   ```
4. В окне NSSM:
   - Path: `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\server-go\main.exe`
   - Startup directory: `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\server-go`
   - Install service
5. Запустите:
   ```powershell
   C:\nssm\nssm.exe start SafeGramBackend
   ```

---

## 🔒 Шаг 8: Настройка Firewall

```powershell
# Откройте порт 8080 в Windows Firewall
New-NetFirewallRule -DisplayName "SafeGram Backend" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

---

## ✅ Шаг 9: Обновление Vercel

1. Зайдите в Vercel Dashboard
2. Выберите проект SafeGram
3. Settings → Environment Variables
4. Добавьте/обновите:
   - `VITE_API_URL=https://ваш-ngrok-url.ngrok-free.app`
5. Redeploy

**Важно:** ngrok URL меняется при каждом перезапуске (на бесплатном плане).
Для постоянного URL нужен:
- ngrok платный план ($8/месяц)
- Или используйте Cloudflare Tunnel (бесплатно и постоянный URL)

---

## 🌐 Шаг 10: Cloudflare Tunnel (постоянный URL бесплатно!)

Cloudflare Tunnel лучше ngrok - дает постоянный URL бесплатно.

### Установка:

1. Скачайте cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Распакуйте `cloudflared.exe` в `C:\cloudflared\`
3. Зарегистрируйтесь на https://dash.cloudflare.com (бесплатно)
4. Авторизуйтесь:
   ```powershell
   C:\cloudflared\cloudflared.exe tunnel login
   ```
5. Создайте туннель:
   ```powershell
   C:\cloudflared\cloudflared.exe tunnel create safegram
   ```
6. Запустите туннель:
   ```powershell
   C:\cloudflared\cloudflared.exe tunnel run safegram
   ```

**Это даст постоянный URL!**

Для автозапуска добавьте в Task Scheduler или создайте .bat файл.

---

## 📊 Мониторинг

### Проверка статуса:

```powershell
# Проверка что backend работает
Invoke-WebRequest http://localhost:8080/health

# Проверка PostgreSQL
docker ps | findstr postgres
```

### Логи:

Логи backend выводятся в консоль. Для сохранения:

```powershell
# Запуск с логированием
.\main.exe > server.log 2>&1
```

---

## 🔧 Troubleshooting

### Проблема: Порт 8080 занят

**Решение:**
```powershell
# Найти процесс
netstat -ano | findstr :8080
# Убить процесс (замените PID)
taskkill /PID <PID> /F
```

### Проблема: PostgreSQL не подключается

**Решение:**
```powershell
# Проверьте что Docker контейнер запущен
docker ps

# Если нет, запустите
docker start safegram-postgres
```

### Проблема: ngrok URL недоступен

**Решение:**
- Проверьте что backend работает: http://localhost:8080/health
- Проверьте что ngrok запущен
- Попробуйте перезапустить ngrok

---

## ✅ Готово!

Теперь ваш ПК работает как сервер SafeGram!

**Локальный URL:** http://localhost:8080
**Публичный URL:** https://ваш-ngrok-url.ngrok-free.app (или Cloudflare Tunnel)

---

## 💡 Советы

1. **Для постоянного URL:** Используйте Cloudflare Tunnel вместо ngrok
2. **Для автозапуска:** Настройте Task Scheduler
3. **Для мониторинга:** Используйте ngrok dashboard (бесплатно)
4. **Для безопасности:** Не публикуйте ваш JWT_SECRET и другие секреты

---

## 🚀 Быстрый старт (один скрипт)

См. `START_LOCAL_SERVER.bat` для автоматического запуска всего сразу.
