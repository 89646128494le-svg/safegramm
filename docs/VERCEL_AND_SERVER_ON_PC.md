# Деплой: фронт на Vercel, API на твоём ПК

Схема: **веб-приложение** раздаётся с Vercel (после пуша в GitHub), **все запросы API и WebSocket** идут на твой компьютер, где запущен server-go. Для доступа с интернета к ПК нужен туннель.

## 1. Сервер на ПК

1. На своём ПК запусти **server-go** (PostgreSQL и Redis должны быть доступны):
   ```bash
   cd server-go
   cp .env.example .env
   # Заполни .env: DATABASE_URL, JWT_SECRET, REDIS_URL, PORT=8080
   go run .
   ```
   Сервер слушает, например, `http://localhost:8080`.

2. Подними **туннель** с ПК в интернет (один из вариантов):
   - **ngrok**: `ngrok http 8080` → получишь URL вида `https://xxxx.ngrok-free.app`
   - **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:8080`
   - **localtunnel**: `npx localtunnel --port 8080`

   Запомни **публичный URL туннеля** (например `https://xxxx.ngrok-free.app`) — он будет базой для API.

3. В **server-go** разреши CORS с домена Vercel. В `server-go/.env`:
   ```env
   ALLOWED_ORIGINS=https://твой-проект.vercel.app,https://твой-проект-*.vercel.app
   ```
   Подставь реальный домен своего приложения на Vercel (можно несколько через запятую). Для превью-деплоев добавь шаблон с `*`, если твой хостинг так отдаёт Origin.

## 2. Фронт на Vercel (GitHub → Vercel)

1. Залей код в **GitHub** (веб-приложение в папке `web` или корень с `web`).

2. В **Vercel**: New Project → импорт репозитория.
   - **Root Directory**: `web` (если фронт лежит в папке `web`).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. Укажи **переменную окружения** для сборки:
   - Имя: `VITE_API_URL`
   - Значение: **URL туннеля** (например `https://xxxx.ngrok-free.app`) **без** завершающего слэша.
   - Применять: Production, Preview (при необходимости).

4. Собери и задеплой. При сборке Vite подставит `VITE_API_URL` в код — все запросы (REST и WebSocket) пойдут на этот URL, т.е. на твой ПК через туннель.

## 3. Альтернатива: config.json (без пересборки)

Если не хочешь менять переменные в Vercel при смене туннеля:

1. В репозитории в **web/public** создай файл **config.json** (можно скопировать из `config.json.example`):
   ```json
   { "apiUrl": "https://твой-туннель.ngrok.io" }
   ```
2. Собери и задеплой как обычно. Приложение при старте запросит `/config.json` и возьмёт оттуда `apiUrl`. Если файла нет или в нём нет `apiUrl`, используется `VITE_API_URL` из сборки.

Так можно менять URL API, просто править `config.json` в репо и делать новый деплой (или использовать один и тот же `config.json` для всех окружений).

## 4. Итог

- **Пользователи** открывают сайт на Vercel.
- **Сайт** шлёт все запросы на `VITE_API_URL` или на `apiUrl` из `config.json` → туннель → твой ПК → server-go.
- **Твой ПК** должен быть включён и держать запущенными server-go и туннель; при смене URL туннеля обнови `VITE_API_URL` в Vercel (или `config.json`) и при необходимости `ALLOWED_ORIGINS` в server-go.
