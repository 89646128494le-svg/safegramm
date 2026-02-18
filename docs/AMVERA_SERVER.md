# Деплой SafeGram API на Amvera (Amverum Cloud)

Сервер (server-go) можно развернуть на [Amvera](https://amverum.com): Git push → сборка → запуск. Поддерживаются нативный Go (через `amverum.yaml`) и Docker (через `Dockerfile`).

## 1. Репозиторий

- **Вариант A:** Отдельный репозиторий только с содержимым `server-go` (корень = server-go).
- **Вариант B:** Монорепо: в настройках приложения Amvera укажите **корневую папку сборки** = `server-go` (если платформа это поддерживает).

В корне сборки должны лежать: `go.mod`, `main.go`, `amverum.yaml` (или `Dockerfile`), папка `internal/`.

## 2. Конфигурация Amvera

### Переменные окружения (обязательные)

| Переменная       | Описание |
|------------------|----------|
| `DATABASE_URL`   | PostgreSQL, например от управляемой БД Amvera |
| `JWT_SECRET`     | Секрет для JWT (минимум 32 символа) |
| `PORT`           | Порт приложения (обычно задаётся платформой, по умолчанию 8080) |

### Рекомендуемые

| Переменная       | Описание |
|------------------|----------|
| `REDIS_URL`      | Redis для онлайн-статуса и кэша (если есть managed Redis) |
| `ALLOWED_ORIGINS`| Домен фронта (Vercel), например `https://your-app.vercel.app` |
| `NODE_ENV`       | `production` |

Остальные переменные — по необходимости: email, VAPID, GEMINI_API_KEY, WEBHOOK_URL и т.д. (см. `server-go/.env.example`).

## 3. База данных и Redis

- В панели Amvera создайте **PostgreSQL** и при необходимости **Redis**.
- Подставьте выданные строки подключения в `DATABASE_URL` и `REDIS_URL`.

## 4. Деплой

- Подключите Git-репозиторий к приложению Amvera.
- Убедитесь, что в корне сборки есть либо `amverum.yaml`, либо `Dockerfile`.
- После `git push` платформа соберёт и запустит приложение. Порт указывается в `amverum.yaml` (`run.port: 8080`) или через переменную `PORT`.

## 5. Фронтенд (Vercel)

- В настройках проекта на Vercel задайте **Environment Variable**:  
  `VITE_API_URL` = `https://<ваше-приложение>.amverum.com` (или URL, который выдаёт Amvera).
- Либо используйте runtime `config.json` (см. `docs/VERCEL_AND_SERVER_ON_PC.md`): в `apiUrl` укажите URL API на Amvera.

После этого веб-клиент будет ходить на API, развёрнутый на Amvera.
