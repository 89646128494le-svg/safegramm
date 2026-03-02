# Почта в Docker (Sprintbox / Linux)

Если на сервере письма с кодами не приходят, проверь по шагам.

## 1. Переменные в .env на сервере

Файл `.env` должен лежать **в той же папке**, откуда запускаешь `docker compose` (рядом с `docker-compose.yml`), и в нём должны быть **раскомментированы** и заполнены:

```env
EMAIL_PROVIDER=gmail
GMAIL_USER=твой@gmail.com
GMAIL_APP_PASSWORD=пароль-приложения-16-символов
EMAIL_FROM_NAME=SafeGram
```

Пароль приложения: Google → Безопасность → 2FA → Пароли приложений. В .env можно писать с пробелами (`xxxx xxxx xxxx xxxx`) — сервер уберёт их сам.

## 2. Перезапуск после смены .env

После любого изменения `.env` контейнер нужно пересоздать, иначе старые переменные останутся в процессе:

```bash
cd /path/to/server-go
docker compose up -d --force-recreate api
```

## 3. Проверка: видит ли контейнер переменные

На сервере выполни:

```bash
docker compose exec api env | grep -E 'GMAIL|EMAIL'
```

Должны быть видны `EMAIL_PROVIDER=gmail`, `GMAIL_USER=...`, `GMAIL_APP_PASSWORD=...`. Если строк пусто — в `.env` на хосте нет этих переменных или compose читает другой файл.

## 4. Проверка: доступен ли SMTP из контейнера

Некоторые хостинги (в т.ч. часть VPS) блокируют исходящий порт 587 (SMTP). Проверка с сервера:

```bash
docker compose exec api wget -q -O- --connect-timeout=5 https://smtp.gmail.com 2>&1 || true
```

Или с хоста (без Docker):

```bash
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/smtp.gmail.com/587' 2>/dev/null && echo "Порт 587 открыт" || echo "Порт 587 недоступен (возможна блокировка)"
```

Если порт недоступен — используй провайдера с API (без прямого SMTP): в `.env` задай `EMAIL_PROVIDER=sendgrid` или `resend` и соответствующие ключи (см. основной .env.example).

## 5. Проверка, что почта «увиделась» приложением

Открой в браузере или выполни с любого компьютера:

```bash
curl -s https://твой-домен/api/auth/email-status
```

Ожидаемый ответ при правильном .env: `{"configured":true,"message":"ok"}`. Если `configured: false` — в контейнер не попали переменные (см. шаги 1–3).
