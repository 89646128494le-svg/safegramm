#!/bin/bash
# Health check скрипт для SafeGram

set -e

FRONTEND_URL="${FRONTEND_URL:-https://yourdomain.com}"
BACKEND_URL="${BACKEND_URL:-https://yourdomain.com/api}"

echo "Running health checks..."

# Проверка frontend
echo -n "Frontend health check... "
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/health" || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✓ OK"
else
    echo "✗ FAILED (HTTP $FRONTEND_STATUS)"
    exit 1
fi

# Проверка backend
echo -n "Backend health check... "
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✓ OK"
else
    echo "✗ FAILED (HTTP $BACKEND_STATUS)"
    exit 1
fi

# Проверка базы данных
echo -n "Database connection... "
if docker exec safegram-db-1 pg_isready -U safegram > /dev/null 2>&1; then
    echo "✓ OK"
else
    echo "✗ FAILED"
    exit 1
fi

# Проверка Redis
echo -n "Redis connection... "
if docker exec safegram-redis-1 redis-cli ping > /dev/null 2>&1; then
    echo "✓ OK"
else
    echo "✗ FAILED"
    exit 1
fi

echo "All health checks passed!"
