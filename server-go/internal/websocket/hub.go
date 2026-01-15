package websocket

import (
	"encoding/json"
	"log"
	"time"

	"safegram-server/internal/redis"
)

// Hub поддерживает множество активных подключений и рассылает сообщения
type Hub struct {
	// Зарегистрированные клиенты
	clients map[*Client]bool

	// Канал для регистрации клиентов
	register chan *Client

	// Канал для отмены регистрации клиентов
	unregister chan *Client

	// Канал для рассылки сообщений всем клиентам
	broadcast chan []byte

	// Канал для отправки сообщения конкретному чату
	sendToChat chan *ChatMessage
}

type ChatMessage struct {
	ChatID  string
	Message []byte
}

// NewHub создает новый Hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 256),
		sendToChat: make(chan *ChatMessage, 256),
	}
}

// Register регистрирует нового клиента
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Run запускает hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Printf("Client connected: %s", client.userID)
			
			// Устанавливаем пользователя как онлайн в Redis
			redis.SetOnline(client.userID, 5*time.Minute)
			
			// Отправляем событие presence всем клиентам
			onlineUsers, _ := redis.GetOnlineUsers()
			presenceJSON, _ := json.Marshal(map[string]interface{}{
				"type": "presence",
				"data": map[string]interface{}{
					"userId": client.userID,
					"status": "online",
					"online": onlineUsers,
				},
			})
			h.broadcast <- presenceJSON

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client disconnected: %s", client.userID)
				
				// Проверяем, есть ли еще подключения этого пользователя
				hasOtherConnections := false
				for c := range h.clients {
					if c.userID == client.userID {
						hasOtherConnections = true
						break
					}
				}
				
				// Если нет других подключений, устанавливаем офлайн
				if !hasOtherConnections {
					redis.SetOffline(client.userID)
					
					// Отправляем событие presence
					onlineUsers, _ := redis.GetOnlineUsers()
					presenceJSON, _ := json.Marshal(map[string]interface{}{
						"type": "presence",
						"data": map[string]interface{}{
							"userId": client.userID,
							"status": "offline",
							"online": onlineUsers,
						},
					})
					h.broadcast <- presenceJSON
				}
			}

		case message := <-h.broadcast:
			// Рассылаем всем подключенным клиентам
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}

		case chatMsg := <-h.sendToChat:
			// Рассылаем сообщение только клиентам, подписанным на этот чат
			for client := range h.clients {
				if client.isSubscribedToChat(chatMsg.ChatID) {
					select {
					case client.send <- chatMsg.Message:
					default:
						close(client.send)
						delete(h.clients, client)
					}
				}
			}
		}
	}
}

// BroadcastToChat отправляет сообщение всем клиентам в чате
func (h *Hub) BroadcastToChat(chatID string, message []byte) {
	h.sendToChat <- &ChatMessage{
		ChatID:  chatID,
		Message: message,
	}
}

// SendToUser отправляет сообщение конкретному пользователю
func (h *Hub) SendToUser(userID string, message []byte) {
	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

