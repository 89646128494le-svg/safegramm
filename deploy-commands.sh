#!/bin/bash
# Команды для обновления SafeGram на сервере (выполнять в каталоге проекта на сервере, например ~/safegram-api)

set -e

# --- 1) Обновить код из репозитория ---
# Если pull ругается на "untracked files would be overwritten", сначала убери конфликтующие файлы:
# mv docker-compose.backend-only.external-db.yml docker-compose.backend-only.external-db.yml.bak 2>/dev/null || true
# mv docker-compose.backend-only.prebuilt.yml docker-compose.backend-only.prebuilt.yml.bak 2>/dev/null || true
git pull origin main
# или: git pull origin master

# --- 2) Вариант A: Запуск через Docker ---
# cd server-go
# docker build -t safegram-server .
# docker stop safegram-server 2>/dev/null || true
# docker rm safegram-server 2>/dev/null || true
# docker run -d --name safegram-server --restart unless-stopped -p 8080:8080 --env-file .env -v $(pwd)/uploads:/app/uploads -v $(pwd)/logs:/app/logs safegram-server

# --- 2) Вариант B: Сборка и перезапуск бинарника (без Docker) ---
cd server-go
go mod download
CGO_ENABLED=0 go build -o safegram-server .

# Перезапуск через systemd (если настроен юнит safegram):
sudo systemctl restart safegram

# Или вручную: убить старый процесс и запустить новый:
# pkill -f safegram-server || true
# nohup ./safegram-server >> ../logs/server.log 2>&1 &

# --- 3) Фронт (если раздаётся с этого же сервера, а не через Vercel) ---
# cd ../web
# npm ci
# npm run build
# sudo systemctl reload nginx   # если nginx раздаёт ./dist
