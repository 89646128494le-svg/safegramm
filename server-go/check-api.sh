#!/bin/bash
# Quick server-side health checks for backend + Caddy.

set -euo pipefail

echo "=== Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "safegram|caddy|NAMES"
echo ""
echo "=== Backend local :8080 ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health && echo " OK" || echo " FAIL"
echo "=== API maintenance local ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/maintenance/status && echo " OK" || echo " FAIL"
echo ""
echo "=== Through Caddy :443 (local resolve) ==="
curl -sk --resolve safegram.site:443:127.0.0.1 -o /dev/null -w "%{http_code}" https://safegram.site/health && echo " OK" || echo " FAIL"
curl -sk --resolve safegram.site:443:127.0.0.1 -o /dev/null -w "%{http_code}" https://safegram.site/api/maintenance/status && echo " OK" || echo " FAIL"
echo ""
echo "=== Public ==="
curl -sk -o /dev/null -w "%{http_code}" https://safegram.site/api/maintenance/status 2>/dev/null && echo " OK" || echo " FAIL"
echo "=== Tech fallback nip.io ==="
curl -sk -o /dev/null -w "%{http_code}" https://141.8.198.152.nip.io/api/maintenance/status 2>/dev/null && echo " OK" || echo " FAIL"
echo ""
echo "Caddy logs: docker logs caddy-safegram 2>&1 | tail -30"