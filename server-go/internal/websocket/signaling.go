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

	payload := c.marshalMessage(msg)
	if payload == nil {
		return
	}

	switch msgType {
	case "webrtc:offer":
		if toUserID != "" {
			c.hub.SendToUser(toUserID, payload)
		} else if chatID != "" {
			c.hub.SendToChatPeers(chatID, c.userID, payload)
		}

	case "webrtc:answer":
		if toUserID != "" {
			c.hub.SendToUser(toUserID, payload)
		} else if chatID != "" {
			c.hub.SendToChatPeers(chatID, c.userID, payload)
		}

	case "webrtc:ice":
		if toUserID != "" {
			c.hub.SendToUser(toUserID, payload)
		} else if chatID != "" {
			c.hub.SendToChatPeers(chatID, c.userID, payload)
		}

	case "webrtc:hangup":
		if toUserID != "" {
			c.hub.SendToUser(toUserID, payload)
		} else if chatID != "" {
			c.hub.SendToChatPeers(chatID, c.userID, payload)
		}

	case "call:recording:request", "call:recording:response":
		if toUserID != "" {
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		}

	case "screen:share":
		if toUserID != "" {
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		}

	case "voice:signal":
		if toUserID != "" {
			msg["from"] = c.userID
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		}

	case "call:reaction":
		if toUserID != "" {
			c.hub.SendToUser(toUserID, c.marshalMessage(msg))
		} else if chatID != "" {
			c.hub.BroadcastToChat(chatID, c.marshalMessage(msg))
		}

	case "call:speaking":
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

