#!/bin/bash
# Launch the prebuilt backend image and bind it only to localhost.

set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Create .env first (copy .env.example and fill DATABASE_URL and other secrets)."; exit 1; }

docker rm -f safegram-server 2>/dev/null || true
docker stop safegram-api-backend-1 2>/dev/null || true
docker rm -f safegram-api-backend-1 2>/dev/null || true
for cid in $(docker ps -aq --filter "publish=8080" 2>/dev/null); do docker rm -f "$cid" 2>/dev/null || true; done
sleep 1
PID=$(ss -tlnp 2>/dev/null | awk '/:8080 / { gsub(/.*pid=/, ""); gsub(/,.*/, ""); print; exit }')
[ -n "${PID:-}" ] && kill "$PID" 2>/dev/null && sleep 2 && echo "Port 8080 was freed (PID $PID)."
sleep 1
mkdir -p uploads logs
docker run -d \
  --name safegram-server \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  --env-file .env \
  -v "$(pwd)/uploads:/app/uploads" \
  -v "$(pwd)/logs:/app/logs" \
  safegram-server

echo "Container started. Check: curl -s http://127.0.0.1:8080/health"
echo "Logs: docker logs -f safegram-server"