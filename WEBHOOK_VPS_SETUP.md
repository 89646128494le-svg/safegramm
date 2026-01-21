# 🔗 Настройка Webhook через VPS → WSL (Windows)

Инструкция для получения логов от SafeGram сервера на VPS на ваш локальный ПК через WSL.

## 🏗️ Архитектура

```
VPS (Ubuntu/Linux)
  ↓ SafeGram Backend
  ↓ Отправляет логи
  ↓
SSH Tunnel / Ngrok / Port Forward
  ↓
WSL (Windows Subsystem for Linux)
  ↓ Webhook Receiver
  ↓
Ваш ПК (логи в консоль + файлы)
```

## 🚀 Вариант 1: Ngrok (САМЫЙ ПРОСТОЙ) ⭐

### Шаг 1: Установка Ngrok в WSL

```bash
# В WSL терминале
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Или через snap
sudo snap install ngrok
```

### Шаг 2: Запустите Webhook Receiver в WSL

```bash
# Перейдите в директорию проекта
cd /mnt/c/Users/Lev/Desktop/Проекты/SafeGram\ перезапуск/webhook-receiver

# Установите зависимости (если еще не установлены)
npm install

# Запустите receiver
npm start
```

### Шаг 3: Создайте Ngrok Tunnel

```bash
# В новом WSL терминале
ngrok http 3000
```

Вы получите URL вида: `https://xxxx-xx-xxx-xxx-xx.ngrok-free.app`

### Шаг 4: Настройте Webhook на VPS

**Вариант A: Через админ-панель (если frontend доступен)**
1. Войдите в админ-панель SafeGram
2. Перейдите в `/app/admin` → вкладка "Webhook"
3. Введите URL: `https://xxxx-xx-xxx-xxx-xx.ngrok-free.app/webhook`

**Вариант B: Через SSH на VPS**

```bash
# Подключитесь к VPS
ssh user@your-vps-ip

# Отредактируйте .env файл
nano /path/to/safegram/.env

# Добавьте или обновите:
WEBHOOK_URL=https://xxxx-xx-xxx-xxx-xx.ngrok-free.app/webhook

# Перезапустите сервер
# (в зависимости от того, как вы запускаете - systemd, docker, pm2)
sudo systemctl restart safegram
# или
pm2 restart safegram
# или если через docker
docker-compose restart
```

### ✅ Готово!

Теперь все логи с VPS будут приходить на ваш ПК через ngrok!

---

## 🚀 Вариант 2: SSH Reverse Tunnel (БЕЗ ВНЕШНИХ СЕРВИСОВ)

Если не хотите использовать ngrok, можно настроить SSH туннель.

### Шаг 1: Запустите Webhook Receiver в WSL

```bash
cd /mnt/c/Users/Lev/Desktop/Проекты/SafeGram\ перезапуск/webhook-receiver
npm install
npm start
```

### Шаг 2: Настройте SSH Reverse Tunnel

**На вашем ПК (в PowerShell или CMD):**

```powershell
# Создайте SSH туннель от VPS к локальному порту
ssh -R 3000:localhost:3000 user@your-vps-ip -N
```

**Или в WSL:**

```bash
# В WSL терминале
ssh -R 3000:localhost:3000 user@your-vps-ip -N
```

**Что делает команда:**
- `-R 3000:localhost:3000` - пробрасывает порт 3000 с VPS на локальный порт 3000
- `-N` - не выполняет команды, только туннель

### Шаг 3: Настройте Webhook на VPS

На VPS webhook URL будет: `http://localhost:3000/webhook`

```bash
# На VPS
ssh user@your-vps-ip
nano /path/to/safegram/.env

# Добавьте:
WEBHOOK_URL=http://localhost:3000/webhook

# Перезапустите сервер
sudo systemctl restart safegram
```

### Шаг 4: Автозапуск SSH туннеля (опционально)

**Создайте скрипт в WSL:**

```bash
# Создайте файл
nano ~/start-tunnel.sh

# Добавьте содержимое:
#!/bin/bash
while true; do
  ssh -R 3000:localhost:3000 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 user@your-vps-ip -N
  echo "Туннель разорван, переподключение через 5 секунд..."
  sleep 5
done

# Сделайте исполняемым
chmod +x ~/start-tunnel.sh

# Запустите в фоне
nohup ~/start-tunnel.sh > tunnel.log 2>&1 &
```

---

## 🚀 Вариант 3: Autossh (НАДЕЖНЫЙ, с авто-переподключением)

### Установка Autossh в WSL

```bash
sudo apt update
sudo apt install -y autossh
```

### Запуск туннеля

```bash
# Создайте SSH ключ (если еще нет)
ssh-keygen -t ed25519 -C "tunnel-key"

# Скопируйте публичный ключ на VPS
ssh-copy-id user@your-vps-ip

# Запустите autossh
autossh -M 20000 -R 3000:localhost:3000 user@your-vps-ip -N

# Или в фоне
nohup autossh -M 20000 -R 3000:localhost:3000 user@your-vps-ip -N > tunnel.log 2>&1 &
```

**Что делает:**
- `-M 20000` - мониторинг через порт 20000
- Автоматически переподключается при обрыве

### Создайте systemd service (для автозапуска)

```bash
# Создайте файл сервиса
sudo nano /etc/systemd/system/safegram-tunnel.service
```

**Содержимое:**

```ini
[Unit]
Description=SafeGram SSH Tunnel
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/usr/bin/autossh -M 20000 -R 3000:localhost:3000 user@your-vps-ip -N
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Активация:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable safegram-tunnel
sudo systemctl start safegram-tunnel

# Проверка статуса
sudo systemctl status safegram-tunnel
```

---

## 🔧 Вариант 4: Cloudflare Tunnel (бесплатный, без ngrok)

### Установка cloudflared в WSL

```bash
# Скачайте и установите
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Или через snap
sudo snap install cloudflared
```

### Запуск туннеля

```bash
# Запустите туннель
cloudflared tunnel --url http://localhost:3000
```

Вы получите URL вида: `https://xxxx.trycloudflare.com`

Используйте его как webhook URL на VPS.

---

## 📋 Быстрая проверка

### 1. Проверьте Webhook Receiver

```bash
# В WSL
curl http://localhost:3000/status
# Должен вернуть: {"status":"ok",...}
```

### 2. Тест с VPS

```bash
# На VPS
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"level":"info","message":"Test","timestamp":"2024-01-01T00:00:00Z"}]}'

# Должен вернуть: {"success":true,...}
```

### 3. Проверьте логи в WSL

В терминале где запущен webhook receiver должны появиться логи.

---

## 🔒 Безопасность

### Для SSH туннеля:

1. Используйте SSH ключи вместо паролей
2. Отключите парольную аутентификацию на VPS:
   ```bash
   # На VPS в /etc/ssh/sshd_config
   PasswordAuthentication no
   PubkeyAuthentication yes
   ```

3. Ограничьте доступ к порту туннеля только с localhost:
   ```bash
   # На VPS
   # Webhook URL должен быть: http://localhost:3000/webhook
   # А не внешний IP
   ```

### Для Ngrok:

1. Используйте ngrok с аутентификацией:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

2. Ограничьте доступ через ngrok dashboard

---

## ✅ Рекомендации

- **Для разработки**: Ngrok (самый простой)
- **Для продакшена**: SSH Reverse Tunnel + Autossh (надежнее)
- **Для простоты**: Cloudflare Tunnel (бесплатно, как ngrok)

---

## 🐛 Troubleshooting

### Проблема: SSH туннель не работает

**Решение:**
```bash
# Проверьте настройки SSH на VPS
# В /etc/ssh/sshd_config должно быть:
GatewayPorts yes
AllowTcpForwarding yes

# Перезапустите SSH
sudo systemctl restart sshd
```

### Проблема: Порт 3000 занят

**Решение:**
```bash
# Проверьте, что использует порт
lsof -i :3000

# Используйте другой порт для receiver
# В webhook-receiver/index.js измените PORT на 3001
# И соответственно в туннеле: -R 3001:localhost:3001
```

### Проблема: WSL не доступен извне

**Решение:**
- WSL по умолчанию работает только локально
- Используйте `localhost` в туннеле (вариант 2, 3)
- Или используйте ngrok/cloudflare (вариант 1, 4)

---

## 📚 Дополнительно

- Полная документация: `WEBHOOK_SYSTEM.md`
- Быстрый старт: `WEBHOOK_QUICK_START.md`
