package websocket

import (
	"encoding/json"
	"log"
)

// HandleWebRTCMessage обрабатывает WebRTC signaling сообщения
func (c *Client) HandleWebRTCMessage(msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	// Добавляем информацию об отправителе
	msg["from"] = c.userID
	chatID, _ := msg["chatId"].(string)
	toUserID, _ := msg["to"].(string)

	switch msgType {
	case "webrtc:offer":
		// Пересылаем offer конкретному пользователю или всем в чате
		if toUserID != "" {
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		} else if chatID != "" {
			c.hub.BroadcastToChat(chatID, c.marshalMessage(msg))
		}

	case "webrtc:answer":
		// Пересылаем answer конкретному пользователю или всем в чате
		if toUserID != "" {
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		} else if chatID != "" {
			c.hub.BroadcastToChat(chatID, c.marshalMessage(msg))
		}

	case "webrtc:ice":
		// Пересылаем ICE candidate конкретному пользователю или всем в чате
		if toUserID != "" {
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		} else if chatID != "" {
			c.hub.BroadcastToChat(chatID, c.marshalMessage(msg))
		}

	case "webrtc:hangup":
		// Уведомляем о завершении звонка конкретному пользователю или всем в чате
		if toUserID != "" {
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		} else if chatID != "" {
			c.hub.BroadcastToChat(chatID, c.marshalMessage(msg))
		}

	default:
		log.Printf("Unknown WebRTC message type: %s", msgType)
	}
}

func (c *Client) marshalMessage(msg map[string]interface{}) []byte {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal WebRTC message: %v", err)
		return nil
	}
	return data
}

