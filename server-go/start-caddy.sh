#!/bin/bash
# Запуск Caddy: HTTPS на 141.8.198.152.nip.io → бэкенд на 127.0.0.1:8080.
# Сначала запусти бэкенд: bash start-container.sh
# Затем этот скрипт. Открой в фаерволе порты 80 и 443: ufw allow 80; ufw allow 443; ufw status

set -e
cd "$(dirname "$0")"

[ -f Caddyfile ] || { echo "Нет Caddyfile"; exit 1; }

docker rm -f caddy-safegram 2>/dev/null || true
docker run -d \
  --name caddy-safegram \
  --restart unless-stopped \
  --network host \
  -v "$(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v caddy_safegram_data:/data \
  caddy:alpine

echo "Caddy запущен. HTTPS: https://141.8.198.152.nip.io"
echo "Проверь фаервол: ufw allow 80; ufw allow 443"
