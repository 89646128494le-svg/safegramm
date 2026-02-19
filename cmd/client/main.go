package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net"
	"os"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
	"github.com/89646128494le-svg/safegram-core/internal/engine"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
)

const (
	serverAddr = "127.0.0.1:8080"
	keySize    = 32
)

func main() {
	conn, err := net.Dial("tcp", serverAddr)
	if err != nil {
		log.Fatalf("подключение: %v", err)
	}
	defer conn.Close()

	// Handshake: читаем публичный ключ сервера, шлём свой, получаем sessionID
	sessionKey, sessionID, err := handshakeClient(conn)
	if err != nil {
		log.Fatalf("handshake: %v", err)
	}
	log.Printf("сессия установлена, ID=%d", sessionID)

	text := "Hello, SafeGram! Первое зашифрованное сообщение по ECDH."
	if len(os.Args) > 1 {
		text = os.Args[1]
	}
	var core engine.Core
	wire, err := core.SendMessage(sessionID, transport.TypeText, text, sessionKey)
	if err != nil {
		log.Fatalf("send: %v", err)
	}
	if _, err := conn.Write(wire); err != nil {
		log.Fatalf("write: %v", err)
	}
	reply, err := bufio.NewReader(conn).ReadString('\n')
	if err != nil && err != io.EOF {
		log.Fatalf("read reply: %v", err)
	}
	fmt.Print(reply)
}

// handshakeClient: читает 32 байта (публичный ключ сервера), генерирует свою пару,
// отправляет 32 байта (свой публичный ключ), читает 8 байт (sessionID), возвращает sessionKey и sessionID.
func handshakeClient(conn net.Conn) (sessionKey []byte, sessionID uint64, err error) {
	serverPub := make([]byte, keySize)
	if _, err := io.ReadFull(conn, serverPub); err != nil {
		return nil, 0, err
	}
	clientKey, err := crypto.GenerateKeyPair()
	if err != nil {
		return nil, 0, err
	}
	if _, err := conn.Write(clientKey.Public); err != nil {
		return nil, 0, err
	}
	shared, err := crypto.SharedSecret(clientKey.Private, serverPub)
	if err != nil {
		return nil, 0, err
	}
	sessionKey = crypto.DeriveAESKey(shared, nil, []byte("safegram-session-v1"))
	idBuf := make([]byte, 8)
	if _, err := io.ReadFull(conn, idBuf); err != nil {
		return nil, 0, err
	}
	sessionID = binary.LittleEndian.Uint64(idBuf)
	return sessionKey, sessionID, nil
}
