#!/bin/bash

# SafeGram Webhook Receiver - Запуск в WSL
# Этот скрипт запускает webhook receiver в WSL и проверяет доступность

echo "🔗 SafeGram Webhook Receiver - WSL Startup"
echo "==========================================="
echo ""

# Получаем путь к директории скрипта
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js: $(node --version)"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен!"
    exit 1
fi

echo "✅ npm: $(npm --version)"

# Установка зависимостей (если нужно)
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Установка зависимостей..."
    npm install
fi

# Проверка порта
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo ""
    echo "⚠️  Порт 3000 уже занят!"
    echo "Остановите другой процесс или измените PORT в index.js"
    read -p "Продолжить все равно? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Получаем локальный IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "🚀 Запуск Webhook Receiver..."
echo ""
echo "📡 Webhook URL для настройки:"
echo "   Локально: http://localhost:3000/webhook"
echo "   В сети:   http://$LOCAL_IP:3000/webhook"
echo ""
echo "💡 Для использования с VPS:"
echo "   1. Используйте ngrok: ngrok http 3000"
echo "   2. Или SSH туннель: ssh -R 3000:localhost:3000 user@vps-ip"
echo ""
echo "⏹️  Нажмите Ctrl+C для остановки"
echo ""
echo "==========================================="
echo ""

# Запуск сервера
npm start
