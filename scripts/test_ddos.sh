#!/usr/bin/env bash
# Тестовый DDoS: много запросов к API для проверки срабатывания rate limit / защиты.
# Запуск: BASE_URL=http://localhost:8081 ./scripts/test_ddos.sh
# Ожидание: часть запросов получит 429 или соединение будет отклонено — защита работает.

BASE_URL="${BASE_URL:-http://localhost:8081}"
URL="${BASE_URL}/api/notify/status"
COUNT=150
OK=0
RATE=0

for i in $(seq 1 "$COUNT"); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    OK=$((OK+1))
  fi
  printf "\rЗапрос %d/%d (200: %d)" "$i" "$COUNT" "$OK"
done
echo ""

if [ "$OK" -lt "$COUNT" ]; then
  echo "Защита сработала: не все запросы прошли (200: $OK из $COUNT)."
else
  echo "Все запросы вернули 200. Для проверки rate limit настрой Guard или уменьши лимит."
fi
