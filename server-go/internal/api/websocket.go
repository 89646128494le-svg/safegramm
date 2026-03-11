package api

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	gorillaWS "github.com/gorilla/websocket"
	"gorm.io/gorm"
	"safegram-server/internal/config"
	"safegram-server/internal/websocket"
)

var upgrader = gorillaWS.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// В production здесь должна быть проверка origin
		return true
	},
}

// handleWebSocket обрабатывает WebSocket подключения
func handleWebSocket(hub *websocket.Hub, cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		var release func()
		if IsDDoSDisabled() {
			release = func() {}
		} else {
			if !wsConnLimiter.allow(ip) {
				c.JSON(http.StatusTooManyRequests, gin.H{"error": "too_many_websocket_connections"})
				return
			}
			release = wsConnLimiter.acquire(ip)
		}

		// Извлекаем токен из query параметра или заголовка
		tokenString := c.Query("token")
		if tokenString == "" {
			authHeader := c.GetHeader("Authorization")
			if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
				tokenString = authHeader[7:]
			}
		}

		if tokenString == "" {
			release()
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Парсим токен
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			release()
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			release()
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok {
			release()
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		username, _ := claims["username"].(string)
		if maintenance, err := getActiveMaintenance(db); err == nil && maintenance != nil && !isMaintenanceBypassUsername(strings.TrimSpace(username)) {
			release()
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":      "maintenance_active",
				"message":    maintenance.Message,
				"timestamp":  maintenance.Timestamp,
				"id":         maintenance.ID,
				"statusPage": "/status",
			})
			return
		} else if err != nil {
			release()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		// Обновляем соединение до WebSocket
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			release()
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		// Создаем клиента и снимаем лимит по IP при отключении
		client := websocket.NewClient(hub, conn, userID)
		client.SetOnClose(release)
		hub.Register(client)

		// Запускаем горутины для чтения и записи
		go client.WritePump()
		go client.ReadPump()
	}
}
