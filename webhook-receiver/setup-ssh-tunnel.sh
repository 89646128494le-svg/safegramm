#!/bin/bash

# Скрипт для настройки SSH Reverse Tunnel к VPS
# Использование: ./setup-ssh-tunnel.sh user@vps-ip

if [ -z "$1" ]; then
    echo "❌ Использование: $0 user@vps-ip"
    echo ""
    echo "Пример:"
    echo "  $0 root@192.168.1.100"
    echo "  $0 ubuntu@example.com"
    exit 1
fi

VPS_HOST=$1
TUNNEL_PORT=3000

echo "🔗 Настройка SSH Reverse Tunnel"
echo "================================="
echo ""
echo "VPS: $VPS_HOST"
echo "Порт: $TUNNEL_PORT"
echo ""

# Проверка SSH ключа
if [ ! -f ~/.ssh/id_rsa ] && [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "🔑 SSH ключ не найден. Создаем новый..."
    read -p "Email для ключа (опционально): " EMAIL
    if [ -z "$EMAIL" ]; then
        ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
    else
        ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -C "$EMAIL"
    fi
    echo ""
    echo "📋 Скопируйте публичный ключ на VPS:"
    echo "   ssh-copy-id $VPS_HOST"
    echo ""
    read -p "Нажмите Enter после копирования ключа..."
fi

# Проверка autossh
if ! command -v autossh &> /dev/null; then
    echo "📦 Установка autossh для стабильного туннеля..."
    sudo apt-get update
    sudo apt-get install -y autossh
fi

echo ""
echo "🚀 Запуск SSH Reverse Tunnel..."
echo ""
echo "Туннель: VPS:$TUNNEL_PORT → Local:$TUNNEL_PORT"
echo ""
echo "На VPS webhook URL будет: http://localhost:$TUNNEL_PORT/webhook"
echo ""
echo "⏹️  Нажмите Ctrl+C для остановки"
echo ""

# Запуск autossh с мониторингом
autossh -M 20000 \
    -R ${TUNNEL_PORT}:localhost:${TUNNEL_PORT} \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -o StrictHostKeyChecking=no \
    $VPS_HOST \
    -N
