#!/bin/bash
# Запуск Caddy как origin для safegram.site:
# - раздаёт web/dist из /var/www/safegram
# - проксирует /api, /ws, /uploads, /health, /metrics в backend на 127.0.0.1:8080
# Сначала:
# 1) собери web локально и загрузи dist на сервер в /var/www/safegram
# 2) запусти backend: bash start-container.sh
# 3) укажи DNS safegram.site -> VPS
# 4) открой 80/443

set -e
cd "$(dirname "$0")"

[ -f Caddyfile ] || { echo "Нет Caddyfile"; exit 1; }
[ -d /var/www/safegram ] || { echo "Нет /var/www/safegram — сначала загрузи web/dist"; exit 1; }

docker rm -f caddy-safegram 2>/dev/null || true
docker run -d \
  --name caddy-safegram \
  --restart unless-stopped \
  --network host \
  -v "$(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v /var/www/safegram:/srv/safegram:ro \
  -v caddy_safegram_data:/data \
  -v caddy_safegram_config:/config \
  caddy:alpine

echo "Caddy запущен."
echo "Публичный origin: https://safegram.site"
echo "Tech fallback API: https://141.8.198.152.nip.io"
echo "Проверь firewall: ufw allow 80/tcp && ufw allow 443/tcp"
