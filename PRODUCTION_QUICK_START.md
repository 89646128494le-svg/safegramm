# ⚡ Быстрый старт для Production

Минимальный набор действий для запуска SafeGram в production.

## 🔴 Критично - сделать ПЕРЕД запуском

### 1. Секреты (5 минут)
```bash
# Генерация JWT секрета
openssl rand -hex 32

# Генерация Encryption key
openssl rand -hex 32

# Сохраните эти значения в .env файлы
```

### 2. Переменные окружения (10 минут)

**Backend** (`server-go/.env`):
```env
ENV=production
JWT_SECRET=<сгенерированный-секрет>
ENCRYPTION_KEY=<сгенерированный-ключ>
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
ALLOWED_ORIGINS=https://yourdomain.com
```

**Frontend** (`web/.env.production`):
```env
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

### 3. SSL сертификаты (15 минут)
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

### 4. База данных (10 минут)
```bash
# Создайте production базу
createdb safegram_prod

# Примените миграции
cd server-go
go run main.go migrate
```

### 5. Бэкапы (5 минут)
```bash
# Настройте cron для ежедневных бэкапов
0 2 * * * pg_dump safegram_prod > /backups/db_$(date +\%Y\%m\%d).sql
```

## ✅ Проверка перед запуском

- [ ] Все секреты установлены (не дефолтные!)
- [ ] HTTPS настроен
- [ ] База данных создана и миграции применены
- [ ] ALLOWED_ORIGINS содержит только production домены
- [ ] Бэкапы настроены
- [ ] Health checks работают

## 🚀 Запуск

```bash
docker-compose up -d
```

## 📊 Мониторинг

Проверьте:
- `https://yourdomain.com/health`
- `https://yourdomain.com/api/health`
- Логи: `docker-compose logs -f`

---

**Время на настройку**: ~45 минут  
**Критичность**: 🔴 Обязательно
