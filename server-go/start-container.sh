#!/bin/bash
# Запуск контейнера safegram-server (образ должен быть уже собран: docker build -t safegram-server .)
# Запуск из папки server-go:  bash start-container.sh

set -e
cd "$(dirname "$0")"

[ -f .env ] || { echo "Создай .env (скопируй из .env.example и заполни DATABASE_URL и др.)"; exit 1; }

docker stop safegram-server 2>/dev/null || true
docker rm safegram-server 2>/dev/null || true
PID=$(ss -tlnp 2>/dev/null | awk '/:8080 / { gsub(/.*pid=/, ""); gsub(/,.*/, ""); print; exit }')
[ -n "$PID" ] && kill "$PID" 2>/dev/null && sleep 1 && echo "Порт 8080 освобождён (PID $PID)."
mkdir -p uploads logs
docker run -d \
  --name safegram-server \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  -v "$(pwd)/uploads:/app/uploads" \
  -v "$(pwd)/logs:/app/logs" \
  safegram-server

echo "Контейнер запущен. Проверка: curl -s http://127.0.0.1:8080/health"
echo "Логи: docker logs -f safegram-server"
