# 🆓 Oracle Cloud Free Tier - Полная настройка

Пошаговая инструкция для навсегда бесплатного хостинга SafeGram backend.

## 🎯 Что получите

- ✅ 2 виртуальные машины (4 CPU, 24GB RAM каждая)
- ✅ 200GB дискового пространства
- ✅ 10TB трафика/месяц
- ✅ **НАВСЕГДА БЕСПЛАТНО**
- ✅ Не засыпает

---

## 📝 Шаг 1: Регистрация

1. Зайдите на https://cloud.oracle.com
2. Нажмите **"Start for Free"**
3. Заполните форму:
   - Email
   - Пароль
   - Имя, Фамилия
   - Страна
   - **Кредитная карта** (для верификации, НЕ списывают деньги)
4. Подтвердите email
5. Дождитесь активации аккаунта (может занять несколько минут)

---

## 🖥️ Шаг 2: Создание виртуальной машины

1. Войдите в Oracle Cloud Console
2. В меню выберите **"Compute"** → **"Instances"**
3. Нажмите **"Create Instance"**

### Настройки VM:

**Basic Information:**
- **Name:** `safegram-server` (или любое имя)
- **Placement:** Оставьте по умолчанию

**Image and Shape:**
- **Image:** `Canonical Ubuntu 22.04` (выберите из списка)
- **Shape:** `VM.Standard.A1.Flex` (Always Free) ⚠️ **ВАЖНО!**
  - Если не видите, выберите "Change Shape" → "Specialty and Legacy" → "VM.Standard.A1.Flex"
  - OCPUs: `1` (бесплатно)
  - Memory: `6` GB (бесплатно)

**Networking:**
- ✅ **Assign a public IPv4 address** (обязательно!)
- VCN: Создастся автоматически
- Subnet: Создастся автоматически

**Add SSH keys:**
- Выберите **"Generate a key pair for me"** (или загрузите свой)
- Скачайте приватный ключ (`.key` файл) - **СОХРАНИТЕ ЕГО!**

4. Нажмите **"Create"**
5. Дождитесь создания VM (2-3 минуты)

---

## 🔑 Шаг 3: Подключение по SSH

### Windows (PowerShell):

```powershell
# Перейдите в папку где сохранен ключ
cd C:\Users\Lev\Downloads

# Измените права доступа (если нужно)
icacls your-key.key /inheritance:r
icacls your-key.key /grant:r "%username%:R"

# Подключитесь (замените на ваш IP и имя файла)
ssh -i your-key.key opc@your-vm-ip
```

**Или используйте PuTTY:**
1. Скачайте PuTTY: https://www.putty.org/
2. Запустите PuTTYgen
3. Load → выберите ваш `.key` файл
4. Save private key → сохраните как `.ppk`
5. В PuTTY:
   - Host: `opc@your-vm-ip`
   - Connection → SSH → Auth → Credentials → Load ваш `.ppk`
   - Open

### Linux/Mac/WSL:

```bash
# Измените права доступа
chmod 400 your-key.key

# Подключитесь
ssh -i your-key.key opc@your-vm-ip
```

**Имя пользователя может быть:**
- `opc` (для Oracle Linux)
- `ubuntu` (для Ubuntu)
- Проверьте в деталях VM

---

## 🐳 Шаг 4: Установка Docker

После подключения по SSH выполните:

```bash
# Обновите систему
sudo apt update
sudo apt upgrade -y

# Установите Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавьте пользователя в группу docker
sudo usermod -aG docker $USER

# Перезайдите в SSH (или выполните)
newgrp docker

# Проверьте установку
docker --version
```

---

## 🗄️ Шаг 5: Установка PostgreSQL

```bash
# Установите PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Запустите PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Создайте базу данных
sudo -u postgres psql

# В psql выполните:
CREATE DATABASE safegram;
CREATE USER safegram WITH PASSWORD 'ваш-надежный-пароль';
GRANT ALL PRIVILEGES ON DATABASE safegram TO safegram;
\q
```

**Запомните пароль!** Он понадобится для DATABASE_URL.

---

## 📦 Шаг 6: Клонирование репозитория

```bash
# Установите Git (если еще не установлен)
sudo apt install -y git

# Клонируйте репозиторий
cd ~
git clone https://github.com/89646128494le-svg/safegramm.git
cd safegramm/server-go
```

---

## ⚙️ Шаг 7: Настройка переменных окружения

```bash
# Создайте .env файл
nano .env
```

**Добавьте:**

```env
DATABASE_URL=postgres://safegram:ваш-пароль@localhost:5432/safegram?sslmode=disable
JWT_SECRET=сгенерируйте-случайную-строку-32-символа
PORT=8080
WEBHOOK_URL=http://localhost:3000/webhook
NODE_ENV=production
```

**Генерация JWT_SECRET:**
```bash
openssl rand -base64 32
```

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 🚀 Шаг 8: Установка Go и запуск

### Вариант A: Прямой запуск (Go)

```bash
# Установите Go
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Проверьте установку
go version

# Установите зависимости
cd ~/safegramm/server-go
go mod download

# Соберите приложение
go build -o main .

# Запустите
./main
```

### Вариант B: Через Docker (РЕКОМЕНДУЕТСЯ)

```bash
# Перейдите в корень проекта
cd ~/safegramm

# Проверьте docker-compose.yml (если есть)
# Если нет, создайте простой Dockerfile в server-go/
```

**Создайте Dockerfile в `server-go/`:**

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
COPY --from=builder /app/.env .
EXPOSE 8080
CMD ["./main"]
```

**Запустите через Docker:**

```bash
cd ~/safegramm/server-go
docker build -t safegram-backend .
docker run -d -p 8080:8080 --env-file .env --name safegram safegram-backend
```

---

## 🔄 Шаг 9: Автозапуск через systemd

Создайте сервис для автозапуска:

```bash
sudo nano /etc/systemd/system/safegram.service
```

**Содержимое:**

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

# Проверка статуса
sudo systemctl status safegram

# Просмотр логов
sudo journalctl -u safegram -f
```

---

## 🔒 Шаг 10: Настройка Firewall

```bash
# Откройте порт 8080
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# Или если используется ufw:
sudo ufw allow 8080/tcp
sudo ufw enable
```

**В Oracle Cloud Console:**
1. Networking → Virtual Cloud Networks
2. Выберите вашу VCN
3. Security Lists → Default Security List
4. Ingress Rules → Add Ingress Rule
5. Source: `0.0.0.0/0`
6. Destination Port: `8080`
7. Add

---

## ✅ Шаг 11: Проверка

```bash
# Проверьте что сервер запущен
curl http://localhost:8080/health

# Должен вернуть:
# {"status":"ok","timestamp":{}}
```

**Извне:**
```
http://your-vm-ip:8080/health
```

---

## 🌐 Шаг 12: Настройка домена (опционально)

Если хотите использовать домен вместо IP:

1. Купите домен (например, на Namecheap, GoDaddy)
2. Добавьте A-запись:
   - Name: `@` или `api`
   - Value: `your-vm-ip`
   - TTL: `3600`
3. Подождите распространения DNS (5-30 минут)
4. Настройте nginx для SSL (Let's Encrypt)

---

## 📊 Мониторинг

```bash
# Проверка статуса
sudo systemctl status safegram

# Просмотр логов
sudo journalctl -u safegram -f

# Использование ресурсов
htop
# или
top
```

---

## 🔧 Troubleshooting

### Проблема: Не могу подключиться по SSH

**Решение:**
- Проверьте что VM запущена (Status: Running)
- Проверьте Security List (порт 22 должен быть открыт)
- Проверьте правильность IP адреса

### Проблема: Порт 8080 недоступен извне

**Решение:**
- Проверьте firewall: `sudo ufw status`
- Проверьте Security List в Oracle Cloud Console
- Проверьте что сервер слушает на `0.0.0.0:8080` (не localhost)

### Проблема: PostgreSQL не подключается

**Решение:**
- Проверьте что PostgreSQL запущен: `sudo systemctl status postgresql`
- Проверьте пароль в `.env`
- Проверьте что база создана: `sudo -u postgres psql -l`

---

## ✅ Готово!

Backend работает на Oracle Cloud навсегда бесплатно!

**URL:** `http://your-vm-ip:8080`

**Обновите `VITE_API_URL` в Vercel:**
```
VITE_API_URL=http://your-vm-ip:8080
```

---

## 💡 Дополнительно

### Резервное копирование

```bash
# Бэкап базы данных
sudo -u postgres pg_dump safegram > backup.sql

# Восстановление
sudo -u postgres psql safegram < backup.sql
```

### Обновление кода

```bash
cd ~/safegramm
git pull
cd server-go
go build -o main .
sudo systemctl restart safegram
```

---

## 🎉 Поздравляю!

Теперь у вас есть навсегда бесплатный хостинг для SafeGram backend!
