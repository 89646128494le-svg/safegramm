// Пакет crypto: подпись сообщений Ed25519 (как в транзакциях криптовалют).
// Каждое сообщение подписывается перед отправкой; сервер/клиент верифицируют подпись.
package crypto

import (
	"crypto/ed25519"
	"errors"
)

const Ed25519PublicSize = 32
const Ed25519SignatureSize = 64

var ErrSignatureInvalid = errors.New("crypto: signature verification failed")

// SignEd25519 подписывает сообщение приватным ключом. priv — 64 байта (seed+pub) или 32 (seed).
// Возвращает 64-байтную подпись.
func SignEd25519(priv []byte, msg []byte) ([]byte, error) {
	if len(priv) != ed25519.PrivateKeySize && len(priv) != 32 {
		return nil, ErrInvalidKey
	}
	var key ed25519.PrivateKey
	if len(priv) == 32 {
		key = ed25519.NewKeyFromSeed(priv)
	} else {
		key = priv
	}
	return ed25519.Sign(key, msg), nil
}

// VerifyEd25519 проверяет подпись сообщения. pub — 32 байта, sig — 64 байта.
func VerifyEd25519(pub, msg, sig []byte) bool {
	if len(pub) != Ed25519PublicSize || len(sig) != Ed25519SignatureSize {
		return false
	}
	return ed25519.Verify(pub, msg, sig)
}
