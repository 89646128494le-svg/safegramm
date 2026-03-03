#!/bin/bash
# Полная переустановка бэкенда SafeGram на сервере (Sprintbox, Docker уже установлен).
# Запуск на сервере:
#   Вариант A — с нуля:  cd ~ && bash -c "$(curl -sSL https://raw.githubusercontent.com/89646128494le-svg/safegramm/main/server-go/install-from-scratch.sh)"
#   Вариант B — уже есть клон:  cd ~/safegram-api/server-go && bash install-from-scratch.sh  (тогда только пересборка и перезапуск, папку не трогаем)

set -e

REPO_URL="${SAFEGRAM_REPO_URL:-https://github.com/89646128494le-svg/safegramm.git}"
BRANCH="${SAFEGRAM_BRANCH:-main}"
INSTALL_DIR="${SAFEGRAM_INSTALL_DIR:-$HOME/safegram-api}"

# Если скрипт запущен из папки server-go (есть go.mod и main.go) — только пересборка и перезапуск
RUNNING_FROM_INSIDE=0
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
if [ -f "$SCRIPT_DIR/go.mod" ] && [ -f "$SCRIPT_DIR/main.go" ]; then
  RUNNING_FROM_INSIDE=1
fi

echo "=== SafeGram Backend: полная переустановка ==="
echo "Репозиторий: $REPO_URL (ветка $BRANCH)"
echo "Папка: $INSTALL_DIR"
echo ""

if [ "$RUNNING_FROM_INSIDE" = 1 ]; then
  echo "[1/5] Запуск из папки server-go — только пересборка и перезапуск (клон не удаляю)."
  cd "$SCRIPT_DIR"
else
  # 1) Удалить старую папку
  if [ -d "$INSTALL_DIR" ]; then
    echo "[1/5] Удаляю старую папку $INSTALL_DIR ..."
    rm -rf "$INSTALL_DIR"
    echo "      Готово."
  else
    echo "[1/5] Папка $INSTALL_DIR не найдена — пропуск."
  fi

  # 2) Клонировать репозиторий
  echo "[2/5] Клонирую репозиторий ..."
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR/server-go"
  echo "      Готово."
fi

# 3) Файл .env
if [ ! -f .env ]; then
  echo "[3/5] Файла .env нет — копирую из .env.example. Заполни .env (DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS и т.д.)."
  cp -n .env.example .env
  echo "      Отредактируй: nano $INSTALL_DIR/server-go/.env"
  echo "      Затем запусти этот скрипт снова или выполни вручную шаги 4–5."
  exit 0
else
  echo "[3/5] .env найден — продолжаю."
fi

# 4) Сборка Docker-образа
echo "[4/5] Сборка Docker-образа (может занять несколько минут) ..."
docker build -t safegram-server .
echo "      Готово."

# 5) Остановить старый контейнер и любой процесс на 8080, затем запустить контейнер
echo "[5/5] Запуск контейнера ..."
docker stop safegram-server 2>/dev/null || true
docker rm safegram-server 2>/dev/null || true
# Освободить порт 8080, если занят бинарником/другим процессом
if command -v ss >/dev/null 2>&1; then
  PID=$(ss -tlnp 2>/dev/null | awk '/:8080 / { gsub(/.*pid=/, ""); gsub(/,.*/, ""); print; exit }')
  [ -n "$PID" ] && kill "$PID" 2>/dev/null && sleep 1 && echo "      Освобождён порт 8080 (PID $PID)."
fi
mkdir -p uploads logs
docker run -d \
  --name safegram-server \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  -v "$(pwd)/uploads:/app/uploads" \
  -v "$(pwd)/logs:/app/logs" \
  safegram-server

echo ""
echo "=== Готово. Бэкенд слушает порт 8080. ==="
echo "Проверка: curl -s http://127.0.0.1:8080/health || curl -s http://127.0.0.1:8080/api/health"
echo "Логи:     docker logs -f safegram-server"
