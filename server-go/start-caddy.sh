#!/bin/bash
# Launch Caddy as the public origin for safegram.site.

set -euo pipefail
cd "$(dirname "$0")"

[ -f Caddyfile ] || { echo "Missing Caddyfile"; exit 1; }
[ -d /var/www/safegram ] || { echo "Missing /var/www/safegram - upload web/dist first"; exit 1; }

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

echo "Caddy started."
echo "Public origin: https://safegram.site"
echo "Tech fallback API: https://141.8.198.152.nip.io"
echo "Firewall reminder: ufw allow 80/tcp && ufw allow 443/tcp"