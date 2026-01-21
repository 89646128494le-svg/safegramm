# ⚡ Oracle Cloud - Быстрый старт

Самая простая инструкция для навсегда бесплатного хостинга.

## 🎯 Что нужно сделать

1. Зарегистрироваться на Oracle Cloud (5 минут)
2. Создать VM (2 минуты)
3. Подключиться по SSH (1 минута)
4. Запустить через Docker (5 минут)
5. Готово! 🎉

---

## 📝 Шаг 1: Регистрация

1. https://cloud.oracle.com → "Start for Free"
2. Заполните форму (нужна кредитная карта для верификации - НЕ списывают)
3. Подтвердите email

---

## 🖥️ Шаг 2: Создание VM

1. Compute → Instances → Create Instance
2. Name: `safegram-server`
3. Image: `Canonical Ubuntu 22.04`
4. Shape: `VM.Standard.A1.Flex` (Always Free) - **ОБЯЗАТЕЛЬНО!**
5. ✅ Assign a public IPv4 address
6. SSH keys: Generate a key pair
7. Create

**Скопируйте публичный IP адрес!**

---

## 🔑 Шаг 3: Подключение

**Windows (PowerShell):**
```powershell
ssh -i путь-к-ключу.key opc@ваш-ip
```

**Или через PuTTY** (проще для Windows)

---

## 🚀 Шаг 4: Быстрая установка (один скрипт)

После подключения по SSH выполните:

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Установка Git
sudo apt update
sudo apt install -y git

# Клонирование репозитория
cd ~
git clone https://github.com/89646128494le-svg/safegramm.git
cd safegramm/server-go

# Установка Go
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Создание базы данных
sudo -u postgres psql -c "CREATE DATABASE safegram;"
sudo -u postgres psql -c "CREATE USER safegram WITH PASSWORD 'safegram123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE safegram TO safegram;"

# Создание .env файла
cat > .env << EOF
DATABASE_URL=postgres://safegram:safegram123@localhost:5432/safegram?sslmode=disable
JWT_SECRET=$(openssl rand -base64 32)
PORT=8080
WEBHOOK_URL=http://localhost:3000/webhook
NODE_ENV=production
EOF

# Установка зависимостей и сборка
go mod download
go build -o main .

# Запуск в фоне
nohup ./main > server.log 2>&1 &
```

---

## 🔒 Шаг 5: Открытие порта

**В Oracle Cloud Console:**
1. Networking → Virtual Cloud Networks
2. Выберите вашу VCN
3. Security Lists → Default Security List
4. Ingress Rules → Add Ingress Rule
5. Source: `0.0.0.0/0`
6. Destination Port: `8080`
7. Add

**На сервере:**
```bash
sudo ufw allow 8080/tcp
sudo ufw enable
```

---

## ✅ Шаг 6: Проверка

```bash
# Проверка что сервер работает
curl http://localhost:8080/health

# Должен вернуть: {"status":"ok","timestamp":{}}
```

**Из браузера:**
```
http://ваш-ip:8080/health
```

---

## 🔄 Автозапуск (чтобы работало после перезагрузки)

```bash
sudo nano /etc/systemd/system/safegram.service
```

**Вставьте:**

```ini
[Unit]
Description=SafeGram Backend
After=network.target postgresql.service

[Service]
Type=simple
User=opc
WorkingDirectory=/home/opc/safegramm/server-go
EnvironmentFile=/home/opc/safegramm/server-go/.env
ExecStart=/home/opc/safegramm/server-go/main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Активация:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable safegram
sudo systemctl start safegram
```

---

## 🌐 Обновление Frontend

В Vercel:
1. Settings → Environment Variables
2. `VITE_API_URL=http://ваш-ip:8080`
3. Перезапустите деплой

---

## ✅ Готово!

Backend работает навсегда бесплатно на Oracle Cloud!

**URL:** `http://ваш-ip:8080`

---

## 📚 Подробная инструкция

См. `ORACLE_CLOUD_SETUP.md` для деталей и troubleshooting.
