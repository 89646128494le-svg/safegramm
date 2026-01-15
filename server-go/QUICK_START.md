# 🚀 Быстрый старт Go бэкенда

## ✅ Что готово

- ✅ Все модели данных
- ✅ Миграции БД
- ✅ API endpoints (auth, users, chats, messages)
- ✅ WebSocket поддержка
- ✅ JWT аутентификация

---

## 🏃 Запуск

### 1. Убедитесь, что PostgreSQL запущен

```bash
# Через Docker
docker compose up -d db

# Или проверьте подключение
psql -h localhost -U safegram -d safegram
```

### 2. Настройте переменные окружения

Создайте файл `server-go/.env`:

```env
DATABASE_URL=postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable
JWT_SECRET=your-secret-key-here-change-in-production
REDIS_URL=redis://localhost:6379
PORT=8080
NODE_ENV=development
```

### 3. Установите зависимости

```bash
cd server-go
go mod download
```

### 4. Запустите сервер

```bash
go run main.go
```

Сервер запустится на `http://localhost:8080`

---

## 🧪 Тестирование

### Регистрация пользователя

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123","email":"test@example.com"}'
```

### Вход

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'
```

### Получить текущего пользователя

```bash
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Создать чат

```bash
curl -X POST http://localhost:8080/api/chats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"type":"dm","memberIds":["user-id-here"]}'
```

---

## 📋 Endpoints

### Публичные
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /health` - Health check

### Защищенные (требуют Authorization: Bearer token)
- `GET /api/users/me` - Текущий пользователь
- `GET /api/users/search?q=query` - Поиск пользователей
- `GET /api/chats` - Список чатов
- `POST /api/chats` - Создать чат
- `GET /api/chats/:id` - Информация о чате
- `GET /api/chats/:id/messages` - Сообщения чата
- `POST /api/messages` - Создать сообщение
- `POST /api/messages/:id/react` - Добавить реакцию
- `POST /api/messages/:id/edit` - Редактировать сообщение
- `POST /api/messages/:id/delete` - Удалить сообщение

### WebSocket
- `GET /ws?token=YOUR_TOKEN` - WebSocket подключение

---

## 🐛 Решение проблем

### Ошибка подключения к БД
- Убедитесь, что PostgreSQL запущен
- Проверьте DATABASE_URL в .env
- Проверьте права доступа пользователя

### Ошибка миграций
- Убедитесь, что БД существует
- Проверьте права пользователя на создание таблиц

### WebSocket не работает
- Проверьте токен в query параметре
- Убедитесь, что используется правильный протокол (ws:// или wss://)

---

**Готово к использованию!** 🎉

