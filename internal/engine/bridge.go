package engine

// Bridge — API для вызова из C++ через CGO (cmd/cbridge).
// Функции InitializeSession, EncryptAndPack, UnpackAndDecrypt экспортируются в C
// директивой //export в cmd/cbridge (GoBridge_InitializeSession, GoBridge_EncryptAndPack, GoBridge_UnpackAndDecrypt).

import (
	"github.com/89646128494le-svg/safegram-core/internal/crypto"
)

// Bridge — API для вызова из CGO (C++). Все буферы фиксированного размера или выделяются в Go.
const BridgeKeySize = crypto.AESKeySize

// BridgeGenerateKeyPair генерирует пару ключей Curve25519.
// privOut и pubOut должны быть не nil и длиной не менее 32 байт; запись идёт с начала.
func BridgeGenerateKeyPair(privOut, pubOut []byte) error {
	if len(privOut) < 32 || len(pubOut) < 32 {
		return crypto.ErrInvalidKey
	}
	kp, err := crypto.GenerateKeyPair()
	if err != nil {
		return err
	}
	copy(privOut, kp.Private)
	copy(pubOut, kp.Public)
	return nil
}

// BridgeSharedSecret выполняет ECDH: shared = ECDH(priv, peerPub).
// priv, peerPub — 32 байта; secretOut — не nil, минимум 32 байта.
func BridgeSharedSecret(priv, peerPub, secretOut []byte) error {
	if len(priv) < 32 || len(peerPub) < 32 || len(secretOut) < 32 {
		return crypto.ErrInvalidKey
	}
	shared, err := crypto.SharedSecret(priv[:32], peerPub[:32])
	if err != nil {
		return err
	}
	copy(secretOut, shared)
	return nil
}

// BridgeDeriveAESKey выводит 32-байтный ключ AES из sharedSecret (32 байта).
// keyOut — не nil, минимум 32 байта. info = "safegram-session-v1".
func BridgeDeriveAESKey(sharedSecret, keyOut []byte) {
	if len(sharedSecret) < 32 || len(keyOut) < 32 {
		return
	}
	key := crypto.DeriveAESKey(sharedSecret[:32], nil, []byte("safegram-session-v1"))
	copy(keyOut, key)
}

// BridgeSendMessage шифрует текст и упаковывает в пакет. Возвращает wire-буфер (владеет вызывающий).
func BridgeSendMessage(sessionID uint64, msgType uint16, text string, key []byte) ([]byte, error) {
	var c Core
	return c.SendMessage(sessionID, msgType, text, key)
}

// BridgeReceiveMessage распаковывает пакет и расшифровывает. Возвращает открытый текст.
func BridgeReceiveMessage(data, key []byte) (string, error) {
	var c Core
	return c.ReceiveMessage(data, key)
}

// InitializeSession по clientPriv и serverPub вычисляет сессионный ключ (ECDH + DeriveAESKey).
// clientPriv, serverPub — 32 байта; sessionKeyOut — не nil, минимум 32 байта.
func InitializeSession(clientPriv, serverPub, sessionKeyOut []byte) error {
	if len(clientPriv) < 32 || len(serverPub) < 32 || len(sessionKeyOut) < 32 {
		return crypto.ErrInvalidKey
	}
	var shared [32]byte
	if err := BridgeSharedSecret(clientPriv, serverPub, shared[:]); err != nil {
		return err
	}
	BridgeDeriveAESKey(shared[:], sessionKeyOut)
	return nil
}

// EncryptAndPack — алиас для BridgeSendMessage (шифрование + упаковка в пакет).
func EncryptAndPack(sessionID uint64, msgType uint16, text string, key []byte) ([]byte, error) {
	return BridgeSendMessage(sessionID, msgType, text, key)
}

// UnpackAndDecrypt — алиас для BridgeReceiveMessage (распаковка + расшифровка).
func UnpackAndDecrypt(data, key []byte) (string, error) {
	return BridgeReceiveMessage(data, key)
}

// BridgeReceivePacket распаковывает пакет и расшифровывает. Возвращает typeID и открытый payload.
func BridgeReceivePacket(data, key []byte) (msgType uint16, plain []byte, err error) {
	var c Core
	return c.ReceivePacket(data, key)
}
