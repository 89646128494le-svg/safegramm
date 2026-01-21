# ⚡ Локальный сервер - Быстрый старт

Запуск SafeGram backend на вашем ПК за 5 минут.

## 🚀 Шаг 1: Подготовка (однократно)

### Установите:

1. **Docker Desktop** (для PostgreSQL)
   - https://www.docker.com/products/docker-desktop
   - Запустите Docker Desktop

2. **Go** (для backend)
   - https://go.dev/dl/go1.21.5.windows-amd64.msi
   - Установите (по умолчанию путь)

3. **ngrok** (для публичного доступа)
   - https://ngrok.com/download
   - Распакуйте в `C:\ngrok\`
   - Зарегистрируйтесь на https://ngrok.com
   - Выполните: `C:\ngrok\ngrok.exe authtoken ваш-токен`

---

## 🚀 Шаг 2: Запуск (каждый раз)

### Вариант A: Автоматический (РЕКОМЕНДУЕТСЯ)

**Просто запустите:**
```
START_LOCAL_SERVER.bat
```

Этот скрипт автоматически:
- ✅ Проверит и соберет backend
- ✅ Запустит PostgreSQL в Docker
- ✅ Запустит Redis в Docker
- ✅ Запустит backend на порту 8080

### Вариант B: Вручную

```powershell
# 1. Запустите PostgreSQL
docker start safegram-postgres

# 2. Перейдите в папку backend
cd "C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\server-go"

# 3. Соберите (если еще не собрано)
go build -o main.exe .

# 4. Запустите
.\main.exe
```

---

## 🌐 Шаг 3: Публичный доступ

### Вариант A: ngrok (быстро, но URL меняется)

**В отдельном окне PowerShell:**
```
SETUP_NGROK.bat
```

Или вручную:
```powershell
C:\ngrok\ngrok.exe http 8080
```

**Скопируйте URL** (например: `https://abc123.ngrok-free.app`)

### Вариант B: Cloudflare Tunnel (постоянный URL, бесплатно!)

**В отдельном окне PowerShell:**
```
SETUP_CLOUDFLARE_TUNNEL.bat
```

**Или быстрый туннель (без настройки):**
```powershell
C:\cloudflared\cloudflared.exe tunnel --url http://localhost:8080
```

---

## ✅ Шаг 4: Обновление Vercel

1. Зайдите в Vercel Dashboard
2. Settings → Environment Variables
3. Обновите `VITE_API_URL`:
   - Для ngrok: `https://ваш-ngrok-url.ngrok-free.app`
   - Для Cloudflare: `https://ваш-постоянный-url.cfargotunnel.com`
4. Redeploy

---

## 🔄 Автозапуск при включении ПК

1. Нажмите `Win + R`
2. Введите `taskschd.msc`
3. Create Basic Task
4. Name: `SafeGram Backend`
5. Trigger: `When I log on`
6. Action: `Start a program`
7. Program: `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск\START_LOCAL_SERVER.bat`
8. Finish

---

## ✅ Готово!

Теперь:
- ✅ Backend работает на http://localhost:8080
- ✅ Публичный доступ через ngrok/Cloudflare
- ✅ Автозапуск при включении ПК

---

## 📚 Подробная инструкция

См. `LOCAL_PC_SERVER.md` для деталей и troubleshooting.
