package main

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/89646128494le-svg/safegram-core/internal/alerts"
	"github.com/89646128494le-svg/safegram-core/internal/crypto"
	"github.com/89646128494le-svg/safegram-core/internal/engine"
	"github.com/89646128494le-svg/safegram-core/internal/store"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
)

const (
	maxBodyLen = 512 * 1024
	keySize    = 32
)

// Guard для DDoS: rate limit handshake, blacklist по нарушениям пакетов, PoW при подозрительной активности.
var guard = transport.NewGuard()

// loadEnv загружает переменные из .env в текущей директории или в корне проекта (если запуск из cmd/server).
func loadEnv() {
	for _, dir := range []string{".", ".."} {
		path := filepath.Join(dir, ".env")
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			i := strings.Index(line, "=")
			if i <= 0 {
				continue
			}
			key := strings.TrimSpace(line[:i])
			val := strings.TrimSpace(line[i+1:])
			if key == "" {
				continue
			}
			if strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"") {
				val = strings.Trim(val, "\"")
			}
			if os.Getenv(key) == "" {
				_ = os.Setenv(key, val)
			}
		}
		f.Close()
		break
	}
}

func main() {
	loadEnv()
	s := store.NewStore()
	store.SetAuditLogPath("logs/admin_audit.dat")
	s.SetAdminLogPath("admin_audit.log")
	go runHTTPAPI(s, guard)
	go runLiveStats(s)
	go alerts.RunBotLoop(func() string {
		logs, _ := store.ReadAuditLog(50)
		ex := engine.DefaultAnomalyScorer().ScoreExplain(logs)
		st := s.GetLiveStats()
		return fmt.Sprintf("Сервер: работает\nАномальность НС: %d%%\nУровень: %s\nЗаписей в логе: %d\nГорутин: %d, Память: %.1f MB, Сессий: %d",
			int(ex.Score*100), ex.Severity, len(logs), st.Goroutines, st.MemoryMB, st.Sessions)
	})
	tcpAddr := ":8080"
	if p := os.Getenv("TCP_PORT"); p != "" {
		tcpAddr = ":" + strings.TrimPrefix(p, ":")
	}
	ln, err := net.Listen("tcp", tcpAddr)
	if err != nil {
		log.Fatal(err)
	}
	defer ln.Close()
	log.Printf("TCP listen %s (DDoS guard: rate limit, blacklist, PoW)", tcpAddr)
	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Printf("accept: %v", err)
			continue
		}
		guard.Traffic.Push(transport.RealIP(conn))
		go handleConn(conn, s)
	}
}

// handshake: сервер шлёт свой публичный ключ (32), читает публичный ключ клиента (32),
// вычисляет общий секрет и сессионный ключ. Возвращает sessionKey и sessionID.
// При необходимости перед handshake выполняется PoW (подозрительная активность).
func handshakeServer(conn net.Conn, s *store.Store) (sessionKey []byte, sessionID uint64, err error) {
	// Агрессивный таймаут: если клиент не прислал публичный ключ за 2 сек — обрыв.
	_ = conn.SetReadDeadline(time.Now().Add(transport.HandshakeReadDeadline))
	defer func() { _ = conn.SetReadDeadline(time.Time{}) }()

	serverKey, err := crypto.GenerateKeyPair()
	if err != nil {
		return nil, 0, err
	}
	if _, err := conn.Write(serverKey.Public); err != nil {
		return nil, 0, err
	}
	clientPub := make([]byte, keySize)
	if _, err := io.ReadFull(conn, clientPub); err != nil {
		return nil, 0, err
	}
	shared, err := crypto.SharedSecret(serverKey.Private, clientPub)
	if err != nil {
		return nil, 0, err
	}
	sessionKey = crypto.DeriveAESKey(shared, nil, []byte("safegram-session-v1"))
	sessionID = s.NextSessionID()
	state := &store.SessionState{
		SessionID: sessionID,
		Key:       sessionKey,
		ConnAddr:  conn.RemoteAddr().String(),
		CreatedAt: time.Now(),
	}
	s.PutSession(sessionID, state)
	return sessionKey, sessionID, nil
}

func reply(conn net.Conn, msg string) {
	_, _ = conn.Write([]byte(msg + "\n"))
}

// runLiveStats раз в секунду собирает метрики и отправляет владельцу (Lev) через store — для Sovereign.
func runLiveStats(s *store.Store) {
	var mem runtime.MemStats
	tick := time.NewTicker(1 * time.Second)
	defer tick.Stop()
	for range tick.C {
		runtime.ReadMemStats(&mem)
		goroutines := runtime.NumGoroutine()
		memMB := float64(mem.Alloc) / (1024 * 1024)
		sessions := s.TCPSessionCount()
		s.SetLiveStats(goroutines, memMB, sessions)
	}
}

// connWithFirstByte возвращает первый прочитанный байт при следующем Read (для отсечения HTTP на порту TCP-протокола).
type connWithFirstByte struct {
	net.Conn
	first byte
	done  bool
}

func (c *connWithFirstByte) Read(p []byte) (n int, err error) {
	if !c.done && len(p) > 0 {
		p[0] = c.first
		c.done = true
		return 1, nil
	}
	return c.Conn.Read(p)
}

func handleConn(conn net.Conn, s *store.Store) {
	defer conn.Close()
	addr := conn.RemoteAddr().String()
	ip := transport.RealIP(conn)

	// Blacklist: не тратим ресурсы на забаненные IP
	if guard.Blacklist.IsBlacklisted(ip) {
		return
	}

	// Если на :8080 пришёл HTTP/WebSocket (браузер), сразу отклонить и не читать как бинарный протокол.
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	one := make([]byte, 1)
	if _, err := io.ReadFull(conn, one); err != nil {
		return
	}
	_ = conn.SetReadDeadline(time.Time{})
	if one[0] == 'G' {
		// GET — HTTP; WebSocket и API на :8081
		_, _ = conn.Write([]byte("HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nUse port 8081 for WebSocket and HTTP API.\r\n"))
		return
	}
	conn = &connWithFirstByte{Conn: conn, first: one[0]}

	// Rate limit или PoW: не более 5 handshake/сек с одного IP; при превышении — задача PoW
	doHandshake := guard.AllowHandshake(ip)
	if !doHandshake && guard.RequirePoW(ip) {
		challenge, err := guard.SendPowChallenge(conn, 2)
		if err != nil {
			return
		}
		ok, err := guard.ReadPowSolution(conn, challenge, ip)
		if err != nil || !ok {
			log.Printf("[%s] PoW failed or timeout", ip)
			return
		}
		doHandshake = true
	}
	if !doHandshake {
		return
	}

	// Фаза 1: ECDH handshake (внутри — таймаут 2 сек на чтение ключа клиента)
	sessionKey, sessionID, err := handshakeServer(conn, s)
	if err != nil {
		log.Printf("[%s] handshake: %v", addr, err)
		reply(conn, "ERR: handshake failed")
		return
	}
	defer s.DeleteSession(sessionID)

	// Отправляем клиенту ID сессии (8 байт, LittleEndian)
	idBuf := make([]byte, 8)
	binary.LittleEndian.PutUint64(idBuf, sessionID)
	if _, err := conn.Write(idBuf); err != nil {
		log.Printf("[%s] write sessionID: %v", addr, err)
		return
	}
	log.Printf("[%s] сессия %d установлена", addr, sessionID)

	var core engine.Core
	for {
		lenBuf := make([]byte, transport.LenSize)
		if _, err := io.ReadFull(conn, lenBuf); err != nil {
			if err != io.EOF {
				log.Printf("[%s] read length: %v", addr, err)
			}
			return
		}
		bodyLen := binary.LittleEndian.Uint32(lenBuf)
		if bodyLen > maxBodyLen {
			log.Printf("[%s] body too large: %d", addr, bodyLen)
			reply(conn, "ERR: body too large")
			continue
		}
		packet := make([]byte, transport.LenSize+int(bodyLen))
		copy(packet, lenBuf)
		if _, err := io.ReadFull(conn, packet[transport.LenSize:]); err != nil {
			log.Printf("[%s] read body: %v", addr, err)
			reply(conn, "ERR: read body")
			return
		}
		msgType, plain, err := core.ReceivePacket(packet, sessionKey)
		if err != nil {
			if transport.IsPacketStructureError(err) {
				guard.RecordPacketViolation(ip)
				if guard.Blacklist.IsBlacklisted(ip) {
					log.Printf("[%s] blacklisted after packet violations", ip)
					return
				}
			}
			log.Printf("[%s] receive: %v", addr, err)
			reply(conn, "ERR: decrypt failed")
			continue
		}
		switch msgType {
		case transport.TypeText:
			log.Printf("[%s] msg: %s", addr, string(plain))
			reply(conn, "Сообщение получено и расшифровано")
		case transport.TypeTyping:
			log.Printf("[%s] typing: %s", addr, string(plain))
			reply(conn, "OK")
		case transport.TypeReadReceipt:
			log.Printf("[%s] read receipt: %s", addr, string(plain))
			reply(conn, "OK")
		case transport.TypeFile:
			log.Printf("[%s] file: %d bytes", addr, len(plain))
			reply(conn, "OK")
		case transport.TypeVoice:
			log.Printf("[%s] voice: %d bytes", addr, len(plain))
			reply(conn, "OK")
		case transport.TypeBindSession:
			token := string(plain)
			sess := s.GetHTTPSessionByToken(token)
			if sess == nil {
				reply(conn, "ERR: invalid token")
				continue
			}
			state := s.GetSession(sessionID)
			if state != nil {
				state.UserID = sess.UserID
				s.PutSession(sessionID, state)
			}
			u := s.GetUserByID(sess.UserID)
			role := store.RoleUser
			if u != nil {
				store.NormalizeUserRole(u)
				role = u.Role
			}
			loginPayload, _ := json.Marshal(map[string]string{"role": role})
			out, err := core.SendMessage(sessionID, transport.TypeLoginSuccess, string(loginPayload), sessionKey)
			if err == nil {
				_, _ = conn.Write(out)
			}
			reply(conn, "OK")
		case transport.TypeAdminQuery:
			state := s.GetSession(sessionID)
			if state == nil || state.UserID == "" {
				reply(conn, "ERR: session not bound")
				continue
			}
			u := s.GetUserByID(state.UserID)
			if u == nil {
				reply(conn, "ERR: user not found")
				continue
			}
			store.NormalizeUserRole(u)
			var req struct {
				Action   string `json:"action"`
				TargetID string `json:"targetId"`
				Reason   string `json:"reason"`
			}
			_ = json.Unmarshal(plain, &req)
			action := req.Action
			if action == "" {
				reply(conn, "ERR: action required")
				continue
			}
			actionMap := map[string]string{
				"Restart": store.ActionRestartServer, "Stop": "stop",
				"Ban": store.ActionBlockUser,
			}
			permAction := actionMap[action]
			if permAction == "" {
				permAction = action
			}
			if !engine.AllowAdminAction(u.Role, u.ID, u.Username, permAction) {
				store.WriteAuditRecord(store.AdminLog{
					Timestamp:  time.Now(),
					AdminID:    u.ID,
					AdminName:  u.Username,
					ActionType: store.AdminActionFailedAdminLogin,
					Reason:     "forbidden",
					Severity:   store.SeverityCritical,
					Extra:      ip,
				})
				reply(conn, "ERR: forbidden")
				continue
			}
			switch action {
			case "Restart":
				store.WriteAuditRecord(store.AdminLog{
					Timestamp:  time.Now(),
					AdminID:    u.ID,
					AdminName:  u.Username,
					ActionType: store.AdminActionServerRestart,
					Reason:     "remote",
					Severity:   store.SeverityCritical,
				})
				reply(conn, "OK")
				time.Sleep(100 * time.Millisecond)
				os.Exit(0)
			case "Stop":
				store.WriteAuditRecord(store.AdminLog{
					Timestamp:  time.Now(),
					AdminID:    u.ID,
					AdminName:  u.Username,
					ActionType: "Stop",
					Reason:     "remote",
					Severity:   store.SeverityCritical,
				})
				reply(conn, "OK")
				time.Sleep(100 * time.Millisecond)
				os.Exit(0)
			case "Ban":
				if req.TargetID == "" {
					reply(conn, "ERR: targetId required")
					continue
				}
				target := s.GetUserByID(req.TargetID)
				if target != nil && store.IsSystemOwner(target.ID, target.Username) {
					reply(conn, "ERR: cannot block owner")
					continue
				}
				s.SetUserBlocked(req.TargetID, true)
				store.WriteAuditRecord(store.AdminLog{
					Timestamp:  time.Now(),
					AdminID:    u.ID,
					AdminName:  u.Username,
					ActionType: store.AdminActionBan,
					TargetID:   req.TargetID,
					TargetName: func() string { if target != nil { return target.Username }; return "" }(),
					Reason:     req.Reason,
					Severity:   store.SeverityModeration,
				})
				reply(conn, "OK")
			default:
				reply(conn, "OK")
			}
		default:
			log.Printf("[%s] unknown type %d", addr, msgType)
			reply(conn, "OK")
		}
	}
}
