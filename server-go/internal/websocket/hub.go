package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"safegram-server/internal/redis"
)

// ChatPeerResolver возвращает userID участников чата (кроме excludeUserID). Для DM — один ID.
type ChatPeerResolver func(chatID string, excludeUserID string) []string

// Hub поддерживает множество активных подключений и рассылает сообщения
type Hub struct {
	clients          map[*Client]bool
	clientsMu        sync.RWMutex
	register         chan *Client
	unregister       chan *Client
	broadcast        chan []byte
	sendToChat       chan *ChatMessage
	voiceRooms       map[string]map[string]bool
	voiceRoomsMu     sync.RWMutex
	voiceAction      chan *VoiceRoomAction
	quit             chan struct{}
	chatPeerResolver ChatPeerResolver
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
		unregister:  make(chan *Client),
		broadcast:   make(chan []byte, 256),
		sendToChat:  make(chan *ChatMessage, 256),
		voiceRooms:  make(map[string]map[string]bool),
		voiceAction: make(chan *VoiceRoomAction, 64),
		quit:        make(chan struct{}),
	}
}

// ConnInfo — данные подключения для топологии (админы/владельцы).
type ConnInfo struct {
	UserID string `json:"userId"`
	IP     string `json:"ip"`
}

// GetConnections возвращает список всех подключённых клиентов (userID, IP).
func (h *Hub) GetConnections() []ConnInfo {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()
	out := make([]ConnInfo, 0, len(h.clients))
	for c := range h.clients {
		ip := ""
		if c.conn != nil {
			ip = c.conn.RemoteAddr().String()
		}
		out = append(out, ConnInfo{UserID: c.userID, IP: ip})
	}
	return out
}

// Shutdown завершает работу hub: отключает клиентов и останавливает Run
func (h *Hub) Shutdown() {
	close(h.quit)
	h.clientsMu.Lock()
	for client := range h.clients {
		close(client.send)
	}
	h.clients = make(map[*Client]bool)
	h.clientsMu.Unlock()
	h.voiceRoomsMu.Lock()
	h.voiceRooms = make(map[string]map[string]bool)
	h.voiceRoomsMu.Unlock()
}

// Register регистрирует нового клиента
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// DisconnectUser принудительно закрывает все активные соединения пользователя.
func (h *Hub) DisconnectUser(userID string) {
	h.clientsMu.RLock()
	targets := make([]*Client, 0)
	for client := range h.clients {
		if client.userID == userID {
			targets = append(targets, client)
		}
	}
	h.clientsMu.RUnlock()
	for _, client := range targets {
		_ = client.conn.Close()
		h.unregister <- client
	}
}

// Run запускает hub
func (h *Hub) Run() {
	for {
		select {
		case <-h.quit:
			return
		case client := <-h.register:
			h.clientsMu.Lock()
			h.clients[client] = true
			h.clientsMu.Unlock()
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
			h.clientsMu.Lock()
			_, ok := h.clients[client]
			if ok {
				delete(h.clients, client)
				close(client.send)
				if client.onClose != nil {
					client.onClose()
				}
			}
			h.clientsMu.Unlock()
			if ok {
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
								h.clientsMu.RLock()
								for c := range h.clients {
									if c.userID == uid {
										select {
										case c.send <- peerLeaveJSON:
										default:
										}
										break
									}
								}
								h.clientsMu.RUnlock()
							}
						}
						break
					}
				}
				h.voiceRoomsMu.Unlock()

				// Проверяем, есть ли еще подключения этого пользователя
				hasOtherConnections := false
				h.clientsMu.RLock()
				for c := range h.clients {
					if c.userID == client.userID {
						hasOtherConnections = true
						break
					}
				}
				h.clientsMu.RUnlock()

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
			h.clientsMu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.clientsMu.RUnlock()

		case chatMsg := <-h.sendToChat:
			h.clientsMu.RLock()
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
			h.clientsMu.RUnlock()

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
					"chatId":  act.ChatID,
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

// SetChatPeerResolver задаёт функцию разрешения участников чата (для доставки звонков без подписки на чат).
func (h *Hub) SetChatPeerResolver(r ChatPeerResolver) {
	h.chatPeerResolver = r
}

// SendToChatPeers отправляет сообщение всем остальным участникам чата по userID (не по подписке).
// Используется для webrtc signaling, чтобы звонок дошёл до абонента, даже если он не открыл чат.
func (h *Hub) SendToChatPeers(chatID string, excludeUserID string, message []byte) {
	if h.chatPeerResolver != nil {
		peerIDs := h.chatPeerResolver(chatID, excludeUserID)
		for _, uid := range peerIDs {
			h.SendToUser(uid, message)
		}
		return
	}
	h.BroadcastToChat(chatID, message)
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
