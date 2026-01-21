#!/bin/bash

# Скрипт для установки и запуска ngrok в WSL

echo "🚀 Настройка Ngrok для SafeGram Webhook"
echo "========================================"
echo ""

# Проверка, установлен ли ngrok
if ! command -v ngrok &> /dev/null; then
    echo "📦 Установка ngrok..."
    
    # Проверка архитектуры
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        NGROK_ARCH="amd64"
    elif [ "$ARCH" = "aarch64" ]; then
        NGROK_ARCH="arm64"
    else
        echo "❌ Неподдерживаемая архитектура: $ARCH"
        exit 1
    fi
    
    # Скачивание ngrok
    echo "📥 Скачивание ngrok..."
    wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${NGROK_ARCH}.tgz -O /tmp/ngrok.tgz
    
    # Распаковка
    tar -xzf /tmp/ngrok.tgz -C /tmp
    sudo mv /tmp/ngrok /usr/local/bin/
    chmod +x /usr/local/bin/ngrok
    
    echo "✅ Ngrok установлен"
    echo ""
fi

echo "✅ Ngrok: $(ngrok version)"
echo ""

# Проверка токена
if [ ! -f ~/.config/ngrok/ngrok.yml ]; then
    echo "🔑 Для использования ngrok нужен auth token"
    echo ""
    echo "1. Зарегистрируйтесь на https://dashboard.ngrok.com/signup"
    echo "2. Скопируйте ваш auth token"
    echo "3. Выполните: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    read -p "У вас есть auth token? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Введите ваш ngrok auth token: " TOKEN
        ngrok config add-authtoken "$TOKEN"
    else
        echo ""
        echo "ℹ️  Можно использовать ngrok без регистрации (ограниченный функционал)"
    fi
fi

echo ""
echo "🚀 Запуск ngrok туннеля..."
echo ""
echo "Ngrok создаст публичный URL для локального webhook receiver"
echo ""
echo "⏹️  Нажмите Ctrl+C для остановки"
echo ""

# Запуск ngrok
ngrok http 3000
