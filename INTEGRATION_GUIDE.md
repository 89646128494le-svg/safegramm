# 🔗 Интеграция управления сервисами через админ-панель

## 📊 Архитектура

```
Vercel (Frontend)
    │
    ├─→ Многостраничный сайт (Landing, Features, Pricing, About)
    │
    └─→ Админ-панель → ServiceManager → Backend API → Управление сервисами
                                                         │
                    ┌───────────────────────────────────┼───────────────────────┐
                    │                                   │                       │
            ┌───────▼──────┐                  ┌─────────▼────────┐    ┌────────▼────────┐
            │   Vercel API │                  │   Docker API     │    │    PM2 API      │
            │  (деплои)    │                  │  (контейнеры)    │    │  (процессы)     │
            └──────────────┘                  └──────────────────┘    └─────────────────┘
```

## ✅ Что уже сделано:

1. **Frontend:**
   - ✅ Многостраничный сайт (Landing, Features, Pricing, About)
   - ✅ Админ-панель с вкладкой "Сервисы"
   - ✅ ServiceManager компонент с UI
   - ✅ Конфигурация Vercel (`vercel.json`)

2. **Backend:**
   - ✅ API эндпоинты в `server-go/internal/api/services.go`:
     - `GET /api/admin/services` - статус сервисов
     - `POST /api/admin/services/:id/start` - запуск
     - `POST /api/admin/services/:id/stop` - остановка
     - `POST /api/admin/services/:id/restart` - перезапуск

3. **Маршруты:**
   - ✅ Добавлены в `server-go/internal/api/routes.go`

## 🔧 Что нужно доработать для полной интеграции:

### 1. Интеграция с Vercel API (для управления деплоями)

```go
// server-go/internal/api/services.go

import (
    "bytes"
    "encoding/json"
    "net/http"
)

func startVercelDeployment(projectID string, serviceID string) error {
    // Vercel API токен из переменных окружения
    token := os.Getenv("VERCEL_TOKEN")
    
    client := &http.Client{}
    req, _ := http.NewRequest("POST", 
        fmt.Sprintf("https://api.vercel.com/v13/deployments"), 
        bytes.NewBuffer([]byte(fmt.Sprintf(`{
            "name": "%s",
            "project": "%s"
        }`, serviceID, projectID))))
    
    req.Header.Set("Authorization", "Bearer "+token)
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    return nil
}
```

**Настройка:**
1. Получите Vercel API токен: Settings → Tokens
2. Добавьте в переменные окружения Backend: `VERCEL_TOKEN`
3. Добавьте Project ID: `VERCEL_PROJECT_ID`

### 2. Интеграция с Docker API (для управления контейнерами)

```go
import (
    "context"
    "github.com/docker/docker/api/types"
    "github.com/docker/docker/client"
)

func startDockerContainer(serviceID string) error {
    cli, err := client.NewClientWithOpts(client.FromEnv)
    if err != nil {
        return err
    }
    
    ctx := context.Background()
    
    // Запуск контейнера
    err = cli.ContainerStart(ctx, serviceID, types.ContainerStartOptions{})
    return err
}
```

**Установка:**
```bash
cd server-go
go get github.com/docker/docker/client
```

### 3. Интеграция с PM2 API (для управления процессами)

```go
import (
    "os/exec"
)

func startPM2Process(serviceID string) error {
    cmd := exec.Command("pm2", "start", serviceID, "--name", serviceID)
    return cmd.Run()
}

func stopPM2Process(serviceID string) error {
    cmd := exec.Command("pm2", "stop", serviceID)
    return cmd.Run()
}

func restartPM2Process(serviceID string) error {
    cmd := exec.Command("pm2", "restart", serviceID)
    return cmd.Run()
}
```

**Требования:**
- PM2 должен быть установлен на сервере
- API процессы должны быть настроены в `ecosystem.config.js`

### 4. Health Check интеграция

```go
func checkServiceHealth(service Service) (*Health, error) {
    switch service.Type {
    case "api":
        // Проверка /health эндпоинта
        resp, err := http.Get(service.URL + "/health")
        if err != nil {
            return &Health{Status: "unhealthy"}, nil
        }
        defer resp.Body.Close()
        return &Health{
            Status:       "healthy",
            ResponseTime: time.Since(start).Milliseconds(),
            LastCheck:    time.Now(),
        }, nil
    
    case "database":
        // Проверка PostgreSQL соединения
        db, err := sql.Open("postgres", service.ConnectionString)
        if err != nil {
            return &Health{Status: "unhealthy"}, nil
        }
        defer db.Close()
        err = db.Ping()
        if err != nil {
            return &Health{Status: "unhealthy"}, nil
        }
        return &Health{Status: "healthy"}, nil
    
    case "telegram":
        // Проверка через Telegram Bot API
        // ...
    }
}
```

## 🚀 Быстрый старт

### Шаг 1: Деплой Frontend на Vercel

```bash
cd web
vercel --prod
```

### Шаг 2: Настройка переменных окружения

**В Vercel Dashboard:**
```
VITE_API_URL=https://your-api-domain.com
```

### Шаг 3: Деплой Backend

```bash
cd server-go
# На Railway, Render, или VPS
railway up  # или другой способ деплоя
```

### Шаг 4: Настройка управления сервисами

1. Добавьте интеграции (Vercel API, Docker, PM2)
2. Обновите `server-go/internal/api/services.go`
3. Перезапустите Backend

### Шаг 5: Использование

1. Зайдите в `/app/admin`
2. Перейдите на вкладку "Сервисы"
3. Управляйте всеми сервисами через UI!

## 📝 Примеры конфигураций

### ecosystem.config.js (для PM2)

```javascript
module.exports = {
  apps: [
    {
      name: 'safegram-api',
      script: './server-go/main',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'safegram-telegram',
      script: './telegram-bot/index.js',
      instances: 1,
      autorestart: true
    }
  ]
};
```

### docker-compose.yml (для Docker)

```yaml
version: '3.8'

services:
  api:
    image: safegram-api:latest
    ports:
      - "8080:8080"
    restart: unless-stopped
    
  telegram:
    image: safegram-telegram:latest
    restart: unless-stopped
```

## 🎯 Готово!

После настройки вы сможете:
- ✅ Управлять всеми сервисами через админ-панель
- ✅ Видеть статус в реальном времени
- ✅ Запускать/останавливать/перезапускать сервисы
- ✅ Мониторить health checks

Все работает через один интерфейс! 🚀
