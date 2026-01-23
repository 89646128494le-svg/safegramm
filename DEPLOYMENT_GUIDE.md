# 🚀 Руководство по развертыванию SafeGram в Production

Пошаговое руководство по развертыванию SafeGram в production окружении.

## Предварительные требования

- Сервер с Ubuntu 20.04+ или аналогичный Linux
- Docker и Docker Compose установлены
- Доменное имя настроено
- SSL сертификат (Let's Encrypt рекомендуется)
- Минимум 2GB RAM, 2 CPU cores, 20GB диска

## Шаг 1: Подготовка сервера

### 1.1 Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Установка Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 1.3 Установка Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Шаг 2: Настройка переменных окружения

### 2.1 Backend (server-go)
```bash
cd server-go
cp .env.production.example .env
nano .env
```

Заполните все обязательные переменные:
- `JWT_SECRET` - сгенерируйте: `openssl rand -hex 32`
- `ENCRYPTION_KEY` - сгенерируйте: `openssl rand -hex 32`
- `DATABASE_URL` - строка подключения к PostgreSQL
- `REDIS_URL` - строка подключения к Redis
- `ALLOWED_ORIGINS` - ваш production домен

### 2.2 Frontend (web)
```bash
cd web
cp .env.production.example .env.production
nano .env.production
```

Установите:
- `VITE_API_URL` - ваш API URL (HTTPS)
- `VITE_WS_URL` - ваш WebSocket URL (WSS)

## Шаг 3: Настройка SSL сертификатов

### 3.1 Использование Let's Encrypt (рекомендуется)
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

Сертификаты будут в `/etc/letsencrypt/live/yourdomain.com/`

### 3.2 Копирование сертификатов
```bash
sudo mkdir -p /opt/safegram/certs
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/safegram/certs/key.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/safegram/certs/cert.pem
sudo chmod 600 /opt/safegram/certs/*
```

## Шаг 4: Настройка базы данных

### 4.1 Создание production базы данных
```sql
CREATE DATABASE safegram_prod;
CREATE USER safegram_user WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE safegram_prod TO safegram_user;
```

### 4.2 Применение миграций
```bash
cd server-go
go run main.go migrate
```

## Шаг 5: Настройка Docker Compose

### 5.1 Обновление docker-compose.yml
Убедитесь, что все сервисы настроены правильно:
- Database с production credentials
- Redis настроен
- Volumes для persistent data
- Health checks включены

### 5.2 Запуск сервисов
```bash
docker-compose up -d
```

## Шаг 6: Настройка Nginx Reverse Proxy

### 6.1 Установка Nginx
```bash
sudo apt install nginx
```

### 6.2 Конфигурация
Создайте `/etc/nginx/sites-available/safegram`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        proxy_pass http://localhost:80;  # Docker web container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;
}
```

### 6.3 Активация конфигурации
```bash
sudo ln -s /etc/nginx/sites-available/safegram /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 7: Настройка автоматических бэкапов

### 7.1 Скрипт бэкапа
Создайте `/opt/safegram/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/safegram/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
docker exec safegram-db-1 pg_dump -U safegram_user safegram_prod > $BACKUP_DIR/db_$DATE.sql

# Backup Redis (если нужно)
docker exec safegram-redis-1 redis-cli SAVE
docker cp safegram-redis-1:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -type f -mtime +30 -delete
```

### 7.2 Cron job
```bash
chmod +x /opt/safegram/backup.sh
crontab -e
# Добавьте:
0 2 * * * /opt/safegram/backup.sh
```

## Шаг 8: Настройка мониторинга

### 8.1 Health checks
Проверьте доступность:
- `https://yourdomain.com/health` - frontend
- `https://yourdomain.com/api/health` - backend

### 8.2 Логирование
```bash
# Просмотр логов
docker-compose logs -f

# Ротация логов
sudo logrotate -d /etc/logrotate.d/docker-containers
```

## Шаг 9: Финальная проверка

### 9.1 Проверка безопасности
- [ ] HTTPS работает
- [ ] Security headers установлены
- [ ] Rate limiting активен
- [ ] CORS настроен правильно
- [ ] Все секреты в .env файлах

### 9.2 Проверка функциональности
- [ ] Регистрация работает
- [ ] Вход работает
- [ ] Отправка сообщений работает
- [ ] WebSocket соединения работают
- [ ] Загрузка файлов работает

### 9.3 Проверка производительности
- [ ] Страницы загружаются быстро
- [ ] API отвечает быстро
- [ ] Нет memory leaks
- [ ] База данных оптимизирована

## Шаг 10: Автоматическое обновление SSL

### 10.1 Certbot renewal
```bash
sudo certbot renew --dry-run
```

Добавьте в crontab:
```bash
0 0 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

## Обслуживание

### Обновление приложения
```bash
git pull
docker-compose build
docker-compose up -d
docker-compose exec server-go go run main.go migrate
```

### Мониторинг ресурсов
```bash
docker stats
df -h
free -h
```

### Просмотр логов
```bash
docker-compose logs -f server-go
docker-compose logs -f web
```

## Troubleshooting

### Проблема: База данных не подключается
- Проверьте DATABASE_URL
- Проверьте firewall правила
- Проверьте логи: `docker-compose logs db`

### Проблема: SSL сертификат не работает
- Проверьте пути к сертификатам
- Проверьте права доступа
- Проверьте конфигурацию Nginx

### Проблема: WebSocket не работает
- Проверьте proxy настройки в Nginx
- Проверьте ALLOWED_ORIGINS
- Проверьте firewall правила

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Проверьте health checks
3. Проверьте мониторинг
4. Обратитесь к документации

---

**Версия**: 1.0  
**Последнее обновление**: 2024
