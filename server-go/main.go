package main

import (
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"safegram-server/internal/api"
	"safegram-server/internal/config"
	"safegram-server/internal/database"
	"safegram-server/internal/logger"
	redis "safegram-server/internal/redis"
	"safegram-server/internal/websocket"
)

func main() {
	// Загрузка переменных окружения
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Инициализация конфигурации
	cfg := config.Load()

	// Инициализация базы данных
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Error("Failed to connect to database", err, map[string]interface{}{
			"service": "database",
		})
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close(db)
	logger.Info("Database connected successfully", map[string]interface{}{
		"service": "database",
	})

	// Выполнение миграций
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Создание индексов
	if err := database.CreateIndexes(db); err != nil {
		log.Printf("Warning: failed to create indexes: %v", err)
	}

	// Инициализация Redis (если используется)
	if cfg.RedisURL != "" {
		if err := redis.Init(cfg.RedisURL); err != nil {
			log.Printf("Warning: Failed to connect to Redis: %v", err)
		} else {
			log.Println("✅ Redis connected")
		}
		defer redis.Close()
	}

	// Инициализация Logger с webhook
	logger.Init(cfg.WebhookURL, cfg.WebhookURL != "")
	defer logger.Flush() // Отправляем все оставшиеся логи при завершении

	// Инициализация WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Настройка роутера
	router := gin.Default()

	// CORS middleware
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "timestamp": gin.H{}})
	})

	// API routes
	api.SetupRoutes(router, db, wsHub, cfg)

	// Запуск сервера
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 SafeGram Server starting on port %s", port)
	logger.Info("SafeGram Server starting", map[string]interface{}{
		"service": "server",
		"port":    port,
		"env":     cfg.NodeEnv,
	})
	// Используем 0.0.0.0 чтобы слушать на всех интерфейсах (для удаленного доступа)
	if err := router.Run("0.0.0.0:" + port); err != nil {
		logger.Error("Failed to start server", err, map[string]interface{}{
			"service": "server",
			"port":    port,
		})
		log.Fatalf("Failed to start server: %v", err)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		
		// Разрешаем все локальные адреса и IP адреса для разработки
		allowedOrigins := []string{
			"http://localhost:8081",
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://26.241.113.242:5173", // IP адрес друга для тестирования
			"https://safegram.app", // production domain
		}

		// Разрешаем все Vercel домены
		isVercelDomain := false
		if origin != "" {
			if strings.Contains(origin, ".vercel.app") || 
			   strings.Contains(origin, ".vercel-dns.com") ||
			   strings.HasPrefix(origin, "https://") && strings.Contains(origin, "safegram") {
				isVercelDomain = true
			}
		}

		// Получаем дополнительные разрешенные origins из переменной окружения
		if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
			additionalOrigins := strings.Split(envOrigins, ",")
			for _, o := range additionalOrigins {
				o = strings.TrimSpace(o)
				if o != "" {
					allowedOrigins = append(allowedOrigins, o)
				}
			}
		}

		// Проверяем локальные IP адреса (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
		isLocalIP := false
		// Также разрешаем любые IP адреса с портом 5173 для разработки (Vite dev server)
		isDevServer := false
		if origin != "" {
			// Разрешаем локальные IP адреса
			if strings.HasPrefix(origin, "http://192.168.") ||
				strings.HasPrefix(origin, "http://10.") ||
				strings.HasPrefix(origin, "http://172.16.") ||
				strings.HasPrefix(origin, "http://172.17.") ||
				strings.HasPrefix(origin, "http://172.18.") ||
				strings.HasPrefix(origin, "http://172.19.") ||
				strings.HasPrefix(origin, "http://172.20.") ||
				strings.HasPrefix(origin, "http://172.21.") ||
				strings.HasPrefix(origin, "http://172.22.") ||
				strings.HasPrefix(origin, "http://172.23.") ||
				strings.HasPrefix(origin, "http://172.24.") ||
				strings.HasPrefix(origin, "http://172.25.") ||
				strings.HasPrefix(origin, "http://172.26.") ||
				strings.HasPrefix(origin, "http://172.27.") ||
				strings.HasPrefix(origin, "http://172.28.") ||
				strings.HasPrefix(origin, "http://172.29.") ||
				strings.HasPrefix(origin, "http://172.30.") ||
				strings.HasPrefix(origin, "http://172.31.") {
				isLocalIP = true
			}
			
			// Разрешаем любые IP адреса с портом 5173 (Vite dev server) для разработки
			// Это позволяет подключаться с любого IP адреса на порту 5173
			if strings.Contains(origin, ":5173") && strings.HasPrefix(origin, "http://") {
				// Проверяем, что это IP адрес (содержит цифры и точки)
				// Убираем http:// и порт, проверяем что осталось похоже на IP
				ipPart := strings.TrimPrefix(origin, "http://")
				ipPart = strings.Split(ipPart, ":")[0]
				// Простая проверка на IP адрес (содержит точки и цифры)
				if strings.Contains(ipPart, ".") && len(strings.Split(ipPart, ".")) == 4 {
					isDevServer = true
				}
			}
		}

		// Разрешаем origin если он в списке, это локальный IP, dev server или Vercel домен
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				c.Header("Access-Control-Allow-Origin", origin)
				allowed = true
				break
			}
		}

		if !allowed && (isLocalIP || isDevServer || isVercelDomain) {
			c.Header("Access-Control-Allow-Origin", origin)
			allowed = true
		}

		// Разрешаем все origins если установлена переменная окружения (для разработки)
		if !allowed && os.Getenv("ALLOW_ALL_ORIGINS") == "true" {
			if origin != "" {
				c.Header("Access-Control-Allow-Origin", origin)
				allowed = true
			}
		}

		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

