package websocket

import (
	"encoding/json"
	"log"
	"sync"
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

	// Голосовые комнаты: chatID -> множество userID
	voiceRooms   map[string]map[string]bool
	voiceRoomsMu sync.RWMutex

	// Действия в голосовой комнате
	voiceAction chan *VoiceRoomAction
}

type ChatMessage struct {
	ChatID  string
	Message []byte
}

type VoiceRoomAction struct {
	ChatID string
	UserID string
	Client *Client
	Join   bool
}

// NewHub создает новый Hub
func NewHub() *Hub {
	return &Hub{
		clients:     make(map[*Client]bool),
		register:    make(chan *Client),
		unregister: make(chan *Client),
		broadcast:   make(chan []byte, 256),
		sendToChat:  make(chan *ChatMessage, 256),
		voiceRooms:  make(map[string]map[string]bool),
		voiceAction: make(chan *VoiceRoomAction, 64),
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

				// Удаляем из голосовых комнат и уведомляем остальных
				h.voiceRoomsMu.Lock()
				for chatID, room := range h.voiceRooms {
					if room[client.userID] {
						delete(room, client.userID)
						if len(room) == 0 {
							delete(h.voiceRooms, chatID)
						} else {
							peerLeaveJSON, _ := json.Marshal(map[string]interface{}{
								"type":   "voice:peer-leave",
								"chatId": chatID,
								"userId": client.userID,
							})
							for uid := range room {
								for c := range h.clients {
									if c.userID == uid {
										select {
										case c.send <- peerLeaveJSON:
										default:
										}
										break
									}
								}
							}
						}
						break
					}
				}
				h.voiceRoomsMu.Unlock()

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

		case act := <-h.voiceAction:
			h.voiceRoomsMu.Lock()
			if act.Join {
				if h.voiceRooms[act.ChatID] == nil {
					h.voiceRooms[act.ChatID] = make(map[string]bool)
				}
				h.voiceRooms[act.ChatID][act.UserID] = true
				act.Client.SubscribeToChat(act.ChatID)
				members := make([]string, 0, len(h.voiceRooms[act.ChatID]))
				for uid := range h.voiceRooms[act.ChatID] {
					members = append(members, uid)
				}
				participantsJSON, _ := json.Marshal(map[string]interface{}{
					"type":    "voice:participants",
					"chatId": act.ChatID,
					"members": members,
				})
				act.Client.send <- participantsJSON
				for uid := range h.voiceRooms[act.ChatID] {
					if uid == act.UserID {
						continue
					}
					peerJoinJSON, _ := json.Marshal(map[string]interface{}{
						"type":   "voice:peer-join",
						"chatId": act.ChatID,
						"userId": act.UserID,
					})
					for client := range h.clients {
						if client.userID == uid {
							select {
							case client.send <- peerJoinJSON:
							default:
							}
							break
						}
					}
				}
			} else {
				if room, ok := h.voiceRooms[act.ChatID]; ok {
					delete(room, act.UserID)
					if len(room) == 0 {
						delete(h.voiceRooms, act.ChatID)
					} else {
						peerLeaveJSON, _ := json.Marshal(map[string]interface{}{
							"type":   "voice:peer-leave",
							"chatId": act.ChatID,
							"userId": act.UserID,
						})
						for uid := range room {
							for client := range h.clients {
								if client.userID == uid {
									select {
									case client.send <- peerLeaveJSON:
									default:
									}
									break
								}
							}
						}
					}
				}
			}
			h.voiceRoomsMu.Unlock()
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

// HandleVoiceRoom обрабатывает вход/выход из голосовой комнаты
func (h *Hub) HandleVoiceRoom(chatID, userID string, client *Client, join bool) {
	select {
	case h.voiceAction <- &VoiceRoomAction{ChatID: chatID, UserID: userID, Client: client, Join: join}:
	default:
	}
}

// GetVoiceRoomParticipants возвращает копию списка userID в голосовой комнате по chatID (для отображения в сайдбаре).
func (h *Hub) GetVoiceRoomParticipants(chatID string) []string {
	h.voiceRoomsMu.RLock()
	defer h.voiceRoomsMu.RUnlock()
	room, ok := h.voiceRooms[chatID]
	if !ok || len(room) == 0 {
		return nil
	}
	out := make([]string, 0, len(room))
	for uid := range room {
		out = append(out, uid)
	}
	return out
}
