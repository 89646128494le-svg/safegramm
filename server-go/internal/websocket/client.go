package websocket

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"safegram-server/internal/redis"
)

const (
	// Максимальное время ожидания для записи сообщения (секунды)
	writeWait = 10

	// Максимальное время ожидания для чтения pong сообщения (секунды)
	pongWait = 60

	// Период отправки ping сообщений (секунды, должен быть меньше pongWait)
	pingPeriod = 54

	// Максимальный размер сообщения
	maxMessageSize = 512 * 1024 // 512 KB
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Client представляет одно WebSocket подключение
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID string
	chats  map[string]bool // Подписки на чаты
}

// NewClient создает нового клиента
func NewClient(hub *Hub, conn *websocket.Conn, userID string) *Client {
	return &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID,
		chats:  make(map[string]bool),
	}
}

// SubscribeToChat подписывает клиента на чат
func (c *Client) SubscribeToChat(chatID string) {
	c.chats[chatID] = true
}

// UnsubscribeFromChat отписывает клиента от чата
func (c *Client) UnsubscribeFromChat(chatID string) {
	delete(c.chats, chatID)
}

// isSubscribedToChat проверяет подписку на чат
func (c *Client) isSubscribedToChat(chatID string) bool {
	return c.chats[chatID]
}

// ReadPump читает сообщения из WebSocket соединения
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	
	// Обновляем онлайн статус каждые 2 минуты
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				// Обновляем TTL онлайн статуса
				redis.SetOnline(c.userID, 5*time.Minute)
			case _, ok := <-c.send:
				// Если канал закрыт, выходим
				if !ok {
					return
				}
			}
		}
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait * time.Second))
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Обработка входящих сообщений
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err == nil {
			// Проверяем тип сообщения
			msgType, _ := msg["type"].(string)
			if msgType == "webrtc:offer" || msgType == "webrtc:answer" || msgType == "webrtc:ice" || msgType == "webrtc:hangup" {
				c.HandleWebRTCMessage(msg)
			} else {
				c.handleMessage(msg)
			}
		}
	}
}

// WritePump отправляет сообщения в WebSocket соединение
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Отправляем все сообщения из очереди
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage обрабатывает входящие сообщения
func (c *Client) handleMessage(msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

		switch msgType {
		case "subscribe":
			if chatID, ok := msg["chatId"].(string); ok {
				c.SubscribeToChat(chatID)
			}
		case "unsubscribe":
			if chatID, ok := msg["chatId"].(string); ok {
				c.UnsubscribeFromChat(chatID)
			}
		case "typing":
			c.HandleTyping(msg)
		}
}

// HandleTyping обрабатывает индикатор печати через WebSocket
func (c *Client) HandleTyping(msg map[string]interface{}) {
	chatID, _ := msg["chatId"].(string)
	isTyping, _ := msg["isTyping"].(bool)

	if chatID != "" {
		typingJSON, _ := json.Marshal(map[string]interface{}{
			"type":     "typing",
			"chatId":   chatID,
			"userId":   c.userID,
			"isTyping": isTyping,
		})
		c.hub.BroadcastToChat(chatID, typingJSON)
	}
}

