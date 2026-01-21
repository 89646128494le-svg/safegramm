# ⚡ Быстрый старт: Webhook через VPS → WSL

## 🎯 Самый простой способ (Ngrok)

### 1. Запустите Webhook Receiver в WSL

```bash
# Откройте WSL терминал
cd /mnt/c/Users/Lev/Desktop/Проекты/SafeGram\ перезапуск/webhook-receiver
npm install
chmod +x setup-ngrok.sh
./setup-ngrok.sh
```

### 2. Получите Ngrok URL

После запуска вы увидите URL вида:
```
Forwarding  https://xxxx-xx-xxx-xx.ngrok-free.app -> http://localhost:3000
```

### 3. Настройте на VPS

На VPS (через SSH):
```bash
# Отредактируйте .env
nano /path/to/safegram/.env

# Добавьте:
WEBHOOK_URL=https://xxxx-xx-xxx-xx.ngrok-free.app/webhook

# Перезапустите сервер
sudo systemctl restart safegram
# или
pm2 restart safegram
```

### ✅ Готово!

Все логи с VPS будут приходить на ваш ПК!

---

## 🔗 Альтернатива: SSH Tunnel (без ngrok)

### 1. Запустите Receiver

```bash
cd webhook-receiver
npm start
# Оставьте запущенным в одном терминале
```

### 2. Создайте SSH Tunnel (в другом терминале)

```bash
chmod +x setup-ssh-tunnel.sh
./setup-ssh-tunnel.sh user@your-vps-ip
```

### 3. Настройте на VPS

На VPS webhook URL: `http://localhost:3000/webhook`

```bash
# На VPS
echo "WEBHOOK_URL=http://localhost:3000/webhook" >> .env
sudo systemctl restart safegram
```

### ✅ Готово!

---

## 📚 Подробные инструкции

См. `WEBHOOK_VPS_SETUP.md` для всех вариантов и troubleshooting.
