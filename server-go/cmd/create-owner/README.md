# Создание аккаунта владельца

## Использование

### Вариант 1: Через Go (рекомендуется)

```bash
cd server-go/cmd/create-owner

# Установите переменную окружения DATABASE_URL (если не установлена)
export DATABASE_URL="postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable"

# Создайте владельца
go run main.go owner mypassword123 owner@example.com
```

### Вариант 2: Через скомпилированный бинарник

```bash
cd server-go/cmd/create-owner
go build -o create-owner.exe main.go

# Windows
create-owner.exe owner mypassword123 owner@example.com

# Linux/Mac
./create-owner owner mypassword123 owner@example.com
```

## Параметры

1. **username** (обязательно) - имя пользователя
2. **password** (обязательно) - пароль
3. **email** (опционально) - email адрес

## Примеры

```bash
# Создать владельца с email
go run main.go admin admin123 admin@safegram.com

# Создать владельца без email
go run main.go owner mypassword123

# Обновить существующего пользователя до владельца
go run main.go existing_user newpassword123
```

## Переменные окружения

- `DATABASE_URL` - URL подключения к PostgreSQL
  - По умолчанию: `postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable`

## Что делает скрипт

1. Подключается к базе данных PostgreSQL
2. Проверяет, существует ли пользователь с таким именем
3. Если пользователь существует - обновляет его роль на `owner`
4. Если пользователя нет - создает нового с ролью `owner`
5. Автоматически устанавливает план `premium` для владельца

## После создания

Войдите в систему с созданными учетными данными. В интерфейсе появится:
- Вкладка "Панель управления" в меню
- Вкладка "Владелец" в панели управления со всеми функциями
