// Пакет main: WebSocket-эндпоинт для бинарного протокола (ECDH + AES-256-GCM).
// Все сообщения проходят через engine; трафик только бинарный.

package main

import (
	"encoding/binary"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
	"github.com/89646128494le-svg/safegram-core/internal/engine"
	"github.com/89646128494le-svg/safegram-core/internal/store"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
	"github.com/gorilla/websocket"
)

const (
	sessionIDSize = 8
	lenSize       = 4
)

// activeWSConnections — счётчик активных WebSocket-соединений для админ-метрик в реальном времени.
var activeWSConnections int32

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     wsCheckOrigin,
}

func wsCheckOrigin(r *http.Request) bool {
	allowed := os.Getenv("ALLOWED_ORIGINS")
	if allowed == "" {
		return true
	}
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}
	for _, o := range strings.Split(allowed, ",") {
		if strings.TrimSpace(o) == origin {
			return true
		}
	}
	return false
}

func handleWebSocket(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimSpace(r.URL.Query().Get("token"))
		if token == "" {
			http.Error(w, "token required", http.StatusUnauthorized)
			return
		}
		sess := s.GetHTTPSessionByToken(token)
		var u *store.User
		if sess != nil && time.Now().Before(sess.ExpiresAt) {
			u = s.GetUserByID(sess.UserID)
		}
		if u == nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		if u.Blocked {
			http.Error(w, "account blocked", http.StatusForbidden)
			return
		}

		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] upgrade: %v", err)
			return
		}
		atomic.AddInt32(&activeWSConnections, 1)
		defer atomic.AddInt32(&activeWSConnections, -1)
		defer conn.Close()

		serverKey, err := crypto.GenerateKeyPair()
		if err != nil {
			log.Printf("[WS] keygen: %v", err)
			return
		}
		if err := conn.WriteMessage(websocket.BinaryMessage, serverKey.Public); err != nil {
			log.Printf("[WS] write server pub: %v", err)
			return
		}

		_, clientPub, err := conn.ReadMessage()
		if err != nil || len(clientPub) != keySize {
			log.Printf("[WS] read client pub: %v (len=%d)", err, len(clientPub))
			return
		}
		shared, err := crypto.SharedSecret(serverKey.Private, clientPub)
		if err != nil {
			log.Printf("[WS] shared secret: %v", err)
			return
		}
		sessionKey := crypto.DeriveAESKey(shared, nil, []byte("safegram-session-v1"))
		sessionID := s.NextSessionID()
		state := &store.SessionState{
			SessionID:   sessionID,
			Key:        sessionKey,
			UserID:     u.ID,
			ConnAddr:   r.RemoteAddr,
			CreatedAt:  time.Now(),
			LastActivity: time.Now(),
		}
		s.PutSession(sessionID, state)
		defer s.DeleteSession(sessionID)

		idBuf := make([]byte, sessionIDSize)
		binary.LittleEndian.PutUint64(idBuf, sessionID)
		if err := conn.WriteMessage(websocket.BinaryMessage, idBuf); err != nil {
			log.Printf("[WS] write sessionID: %v", err)
			return
		}
		log.Printf("[WS] user %s session %d established", u.Username, sessionID)

		var core engine.Core
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				break
			}
			if len(data) < lenSize {
				continue
			}
			bodyLen := binary.LittleEndian.Uint32(data[0:lenSize])
			if bodyLen > maxBodyLen {
				log.Printf("[WS] body too large: %d", bodyLen)
				continue
			}
			if len(data) < int(lenSize)+int(bodyLen) {
				continue
			}
			frame := data[:lenSize+bodyLen]
			state.LastActivity = time.Now()

			var msgType uint16
			var plain []byte
			tryV2 := len(frame) >= transport.MinPacketSizeV2 && u.IdentityPublicKey != nil && len(u.IdentityPublicKey) == 32
			if tryV2 {
				msgType, plain, err = core.ReceiveMessageSigned(frame, sessionKey, u.IdentityPublicKey)
				if err == nil {
					switch msgType {
					case transport.TypeText:
						log.Printf("[WS] [%s] msg (V2 signed): %s", u.Username, string(plain))
						// Ответ в старом формате для совместимости; при необходимости можно V2
						reply, _ := core.SendMessage(sessionID, transport.TypeText, "Сообщение получено и расшифровано", sessionKey)
						_ = conn.WriteMessage(websocket.BinaryMessage, reply)
					case transport.TypeTyping:
						log.Printf("[WS] [%s] typing (V2)", u.Username)
					case transport.TypeReadReceipt:
						log.Printf("[WS] [%s] read receipt (V2)", u.Username)
					default:
						log.Printf("[WS] [%s] type %d (V2)", u.Username, msgType)
					}
					continue
				}
			}
			msgType, plain, err = core.ReceivePacket(frame, sessionKey)
			if err != nil {
				log.Printf("[WS] receive: %v", err)
				continue
			}
			switch msgType {
			case transport.TypeText:
				log.Printf("[WS] [%s] msg: %s", u.Username, string(plain))
				reply, _ := core.SendMessage(sessionID, transport.TypeText, "Сообщение получено и расшифровано", sessionKey)
				_ = conn.WriteMessage(websocket.BinaryMessage, reply)
			case transport.TypeTyping:
				log.Printf("[WS] [%s] typing: %s", u.Username, string(plain))
			case transport.TypeReadReceipt:
				log.Printf("[WS] [%s] read receipt", u.Username)
			default:
				log.Printf("[WS] [%s] type %d", u.Username, msgType)
			}
		}
	}
}
