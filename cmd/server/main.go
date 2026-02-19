package main

import (
	"encoding/binary"
	"io"
	"log"
	"net"
	"time"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
	"github.com/89646128494le-svg/safegram-core/internal/engine"
	"github.com/89646128494le-svg/safegram-core/internal/store"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
)

const (
	listenAddr = ":8080"
	maxBodyLen = 512 * 1024
	keySize    = 32
)

// Guard для DDoS: rate limit handshake, blacklist по нарушениям пакетов, PoW при подозрительной активности.
var guard = transport.NewGuard()

func main() {
	s := store.NewStore()
	go runHTTPAPI(s, guard)
	log.Printf("HTTP API on %s", httpAddr)
	// Слушаем один порт; перед сервером можно поставить Cloudflare Spectrum или свой прокси-кластер (как DC у Telegram).
	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		log.Fatal(err)
	}
	defer ln.Close()
	log.Printf("TCP listen %s (DDoS guard: rate limit, blacklist, PoW)", listenAddr)
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

func handleConn(conn net.Conn, s *store.Store) {
	defer conn.Close()
	addr := conn.RemoteAddr().String()
	ip := transport.RealIP(conn)

	// Blacklist: не тратим ресурсы на забаненные IP
	if guard.Blacklist.IsBlacklisted(ip) {
		return
	}

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
		default:
			log.Printf("[%s] unknown type %d", addr, msgType)
			reply(conn, "OK")
		}
	}
}
