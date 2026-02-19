// Пакет engine: связка crypto и transport. Все сообщения проходят через SendMessage (шифрование) перед отправкой.
// Проверка паролей (bcrypt) и облачного пароля — в движке.
package engine

import (
	"errors"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEncrypt    = errors.New("engine: encrypt failed")
	ErrDecrypt    = errors.New("engine: decrypt failed")
	ErrBadPassword = errors.New("engine: invalid password")
)

// VerifyPassword проверяет пароль против bcrypt-хеша. Вся логика проверки — в движке, клиент не может обойти.
func VerifyPassword(bcryptHash, password string) error {
	if bcryptHash == "" {
		return ErrBadPassword
	}
	if err := bcrypt.CompareHashAndPassword([]byte(bcryptHash), []byte(password)); err != nil {
		return ErrBadPassword
	}
	return nil
}

// HashPassword создаёт bcrypt-хеш пароля (для основного пароля и облачного 2FA).
func HashPassword(password string) (string, error) {
	if password == "" {
		return "", ErrBadPassword
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

// Core ties crypto and transport: encrypt → packet → wire; wire → packet → decrypt.
type Core struct{}

// SendMessage encrypts text with key, builds a packet, returns wire-ready bytes.
func (c *Core) SendMessage(sessionID uint64, msgType uint16, text string, key []byte) ([]byte, error) {
	if len(key) != crypto.AESKeySize {
		return nil, crypto.ErrInvalidKey
	}
	plain := []byte(text)
	enc, err := crypto.EncryptGCM(key, plain, nil)
	if err != nil {
		return nil, errors.Join(ErrEncrypt, err)
	}
	p := &transport.Packet{
		TypeID:    msgType,
		SessionID: sessionID,
		Payload:   enc,
	}
	out, err := transport.Pack(p)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// ReceiveMessage unpacks wire data, verifies checksum, decrypts payload, returns plain text (TypeText only).
func (c *Core) ReceiveMessage(data []byte, key []byte) (string, error) {
	_, plain, err := c.ReceivePacket(data, key)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// ReceivePacket unpacks wire data, decrypts payload, returns typeID and plain payload.
func (c *Core) ReceivePacket(data []byte, key []byte) (msgType uint16, plain []byte, err error) {
	if len(key) != crypto.AESKeySize {
		return 0, nil, crypto.ErrInvalidKey
	}
	p, err := transport.Unpack(data)
	if err != nil {
		return 0, nil, err
	}
	plain, err = crypto.DecryptGCM(key, p.Payload, nil)
	if err != nil {
		return 0, nil, errors.Join(ErrDecrypt, err)
	}
	return p.TypeID, plain, nil
}
