# 🚀 Полная инструкция по деплою SafeGram на Vercel и получению API ключей

## 📋 Оглавление

1. [Деплой на Vercel](#деплой-на-vercel)
2. [Получение API ключей](#получение-api-ключей)
3. [Настройка переменных окружения](#настройка-переменных-окружения)
4. [Деплой Backend](#деплой-backend)
5. [Проверка работы](#проверка-работы)

---

## 🚀 Деплой на Vercel

### Вариант 1: Через GitHub (Рекомендуется)

#### Шаг 1: Добавление файлов в GitHub

```bash
# 1. Перейдите в директорию проекта
cd "c:\Users\Lev\Desktop\Проекты\SafeGram перезапуск"

# 2. Инициализируйте git (если еще не инициализирован)
git init

# 3. Добавьте remote репозиторий
git remote add origin https://github.com/89646128494le-svg/SafeGram3.git
# Или, если remote уже существует:
git remote set-url origin https://github.com/89646128494le-svg/SafeGram3.git

# 4. Добавьте все файлы
git add .

# 5. Создайте коммит
git commit -m "Initial commit: SafeGram multi-page website with admin panel"

# 6. Запушьте в GitHub
git branch -M main
git push -u origin main
```

#### Шаг 2: Импорт в Vercel

1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите в аккаунт (через GitHub)
3. Нажмите **"Add New..."** → **"Project"**
4. Импортируйте репозиторий `89646128494le-svg/SafeGram3`
5. Настройки проекта:
   - **Framework Preset:** Vite
   - **Root Directory:** `web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

6. Нажмите **"Deploy"**

### Вариант 2: Через Vercel CLI

```bash
# 1. Установите Vercel CLI
npm i -g vercel

# 2. Перейдите в директорию web
cd web

# 3. Логин в Vercel
vercel login

# 4. Деплой
vercel

# 5. Production деплой
vercel --prod
```

---

## 🔑 Получение API ключей

### 1. Giphy API Key (для GIF в чатах)

**Где получить:**
1. Перейдите на [developers.giphy.com](https://developers.giphy.com)
2. Нажмите **"Create App"**
3. Выберите **"SDK"** → **"Continue"**
4. Заполните форму:
   - **App Name:** SafeGram
   - **App Description:** Secure messaging app
   - **App URL:** https://your-domain.vercel.app
5. Нажмите **"Create App"**
6. Скопируйте **API Key** (начинается с букв, например: `abc123xyz...`)

**Использование:**
- Переменная: `VITE_GIPHY_API_KEY`
- Где добавить: Vercel Dashboard → Settings → Environment Variables

### 2. Vercel API Token (для управления деплоями)

**Где получить:**
1. Перейдите на [vercel.com](https://vercel.com)
2. Откройте **Settings** → **Tokens**
3. Нажмите **"Create Token"**
4. Укажите:
   - **Name:** SafeGram Service Manager
   - **Scope:** Full Account (или выборочные разрешения)
5. Скопируйте токен (начинается с `vercel_...`)

**Использование:**
- Переменная: `VERCEL_TOKEN`
- Где добавить: Backend сервера (Railway, Render, VPS)
- Нужен для: управления деплоями через админ-панель

### 3. JWT Secret (для аутентификации)

**Как сгенерировать:**

**Вариант A: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Вариант B: PowerShell (Windows)**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Вариант C: Онлайн генератор**
- Перейдите на [randomkeygen.com](https://randomkeygen.com)
- Выберите **"CodeIgniter Encryption Keys"**
- Скопируйте ключ

**Использование:**
- Переменная: `JWT_SECRET`
- Где добавить: Backend сервера
- **⚠️ ВАЖНО:** Никогда не публикуйте этот ключ!

### 4. Database URL (PostgreSQL)

**Вариант A: Supabase (Бесплатный tier)**

1. Перейдите на [supabase.com](https://supabase.com)
2. Создайте проект
3. Откройте **Settings** → **Database**
4. Скопируйте **Connection String**:
   - Формат: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
5. Замените `[YOUR-PASSWORD]` на пароль из **Settings** → **Database** → **Database Password**

**Вариант B: Railway PostgreSQL**

1. Перейдите на [railway.app](https://railway.app)
2. Создайте проект → **"New"** → **"Database"** → **"PostgreSQL"**
3. Откройте базу данных
4. Скопируйте **DATABASE_URL** из **Variables** таба

**Вариант C: Neon.tech (Бесплатный tier)**

1. Перейдите на [neon.tech](https://neon.tech)
2. Создайте проект
3. Скопируйте **Connection String**

**Использование:**
- Переменная: `DATABASE_URL` или `POSTGRES_URL`
- Где добавить: Backend сервера

### 5. Redis URL (для кэширования)

**Вариант A: Upstash (Бесплатный tier)**

1. Перейдите на [upstash.com](https://upstash.com)
2. Создайте Redis database
3. Скопируйте **UPSTASH_REDIS_REST_URL** или **REDIS_URL**

**Вариант B: Railway Redis**

1. Railway → **"New"** → **"Database"** → **"Redis"**
2. Скопируйте **REDIS_URL** из **Variables**

**Вариант C: Redis Cloud (Бесплатный tier)**

1. Перейдите на [redis.com/try-free](https://redis.com/try-free)
2. Создайте базу данных
3. Скопируйте **Connection URL**

**Использование:**
- Переменная: `REDIS_URL`
- Где добавить: Backend сервера

### 6. VAPID Keys (для Push уведомлений)

**Где получить:**

1. Используйте скрипт из проекта:
   ```bash
   # Node.js
   node server/src/generate_vapid.js
   
   # Go
   cd server-go/cmd/generate-vapid
   go run main.go
   ```

2. Или сгенерируйте онлайн:
   - [web-push-codelab.glitch.me](https://web-push-codelab.glitch.me)
   - Нажмите **"Generate VAPID Keys"**

3. Скопируйте **Public Key** и **Private Key**

**Использование:**
- Переменные: `VAPID_PUBLIC_KEY` и `VAPID_PRIVATE_KEY`
- Где добавить: Backend сервера

---

## ⚙️ Настройка переменных окружения

### Frontend (Vercel)

В **Vercel Dashboard** → Ваш проект → **Settings** → **Environment Variables**:

```
VITE_API_URL=https://your-api-domain.com
VITE_GIPHY_API_KEY=ваш_giphy_api_key
```

**Где взять VITE_API_URL:**
- После деплоя Backend API сервера (Railway, Render, etc.)
- Формат: `https://your-api.railway.app` или `https://api.yourdomain.com`

### Backend (Go/Node.js сервер)

**Для Railway:**
1. Railway → Ваш проект → **Variables** таб
2. Добавьте переменные:

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=ваш_сгенерированный_ключ
VAPID_PUBLIC_KEY=ваш_public_key
VAPID_PRIVATE_KEY=ваш_private_key
PORT=8080
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

**Для Render:**
1. Render Dashboard → Ваш сервис → **Environment**
2. Добавьте те же переменные

**Для VPS:**
1. Создайте файл `.env` в директории `server-go/` или `server/`
2. Добавьте все переменные

---

## 🖥️ Деплой Backend

### Вариант 1: Railway (Рекомендуется)

1. Перейдите на [railway.app](https://railway.app)
2. **"New Project"** → **"Deploy from GitHub repo"**
3. Выберите репозиторий `89646128494le-svg/SafeGram3`
4. Настройки:
   - **Root Directory:** `server-go`
   - **Build Command:** `go build -o main .`
   - **Start Command:** `./main`
5. Добавьте переменные окружения (см. выше)
6. Railway автоматически задеплоит

### Вариант 2: Render

1. Перейдите на [render.com](https://render.com)
2. **"New"** → **"Web Service"**
3. Подключите GitHub репозиторий
4. Настройки:
   - **Build Command:** `cd server-go && go build -o main .`
   - **Start Command:** `./server-go/main`
5. Добавьте переменные окружения

### Вариант 3: DigitalOcean App Platform

1. [DigitalOcean](https://www.digitalocean.com/products/app-platform)
2. **"Create App"** → **"GitHub"**
3. Выберите репозиторий и branch
4. Настройте build/run команды
5. Добавьте переменные окружения

---

## ✅ Проверка работы

### 1. Проверка Frontend

1. Откройте ваш Vercel URL (например: `https://safegram-xxx.vercel.app`)
2. Должна открыться Landing страница
3. Проверьте все страницы:
   - `/` - Главная
   - `/features` - Функции
   - `/pricing` - Тарифы
   - `/about` - О нас
   - `/login` - Вход

### 2. Проверка Backend API

```bash
# Health check
curl https://your-api-domain.com/health

# Должен вернуть: {"status":"ok"}
```

### 3. Проверка подключения

1. Откройте `/login`
2. Зарегистрируйте аккаунт или войдите
3. Проверьте работу чатов

### 4. Проверка админ-панели

1. Войдите как admin/owner
2. Перейдите в `/app/admin`
3. Откройте вкладку **"Сервисы"**
4. Проверьте статус всех сервисов

---

## 📊 Итоговая структура переменных окружения

### Frontend (.env в Vercel)

```env
VITE_API_URL=https://your-api.railway.app
VITE_GIPHY_API_KEY=abc123xyz...
```

### Backend (.env на сервере)

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://user:pass@host:6379

# JWT
JWT_SECRET=ваш_64_символьный_ключ

# VAPID (Push notifications)
VAPID_PUBLIC_KEY=ваш_public_key
VAPID_PRIVATE_KEY=ваш_private_key

# Server
PORT=8080
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Vercel API (опционально, для управления деплоями)
VERCEL_TOKEN=vercel_xxx...
VERCEL_PROJECT_ID=prj_xxx...
```

---

## 🎯 Быстрый чек-лист

- [ ] Репозиторий добавлен в GitHub
- [ ] Frontend задеплоен на Vercel
- [ ] Получен Giphy API ключ
- [ ] Сгенерирован JWT Secret
- [ ] Настроена PostgreSQL база данных
- [ ] Настроен Redis
- [ ] Сгенерированы VAPID ключи
- [ ] Backend задеплоен (Railway/Render/etc.)
- [ ] Все переменные окружения добавлены
- [ ] Проверена работа Frontend
- [ ] Проверена работа Backend API
- [ ] Проверена работа админ-панели

---

## 📚 Полезные ссылки

- [Vercel Documentation](https://vercel.com/docs)
- [Giphy API Documentation](https://developers.giphy.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)

---

## ❓ FAQ

**Q: Нужен ли Giphy API ключ обязательно?**
A: Нет, без него просто не будет работать GIF поиск. Остальной функционал работает.

**Q: Можно ли использовать SQLite вместо PostgreSQL?**
A: Технически можно, но не рекомендуется для production. PostgreSQL лучше для масштабирования.

**Q: Обязательно ли использовать Redis?**
A: Redis используется для кэширования и онлайн статусов. Без него приложение будет работать, но медленнее.

**Q: Как изменить домен на Vercel?**
A: Vercel Dashboard → Ваш проект → **Settings** → **Domains** → **Add Domain**

---

## ✅ Готово!

После выполнения всех шагов у вас будет:
- ✅ Многостраничный сайт на Vercel
- ✅ Рабочий Backend API
- ✅ Админ-панель для управления сервисами
- ✅ Все API ключи настроены

Удачи с деплоем! 🚀
