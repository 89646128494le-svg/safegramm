// Пакет engine: связка crypto и transport. Все сообщения проходят через SendMessage (шифрование) перед отправкой.
// Проверка паролей (bcrypt) и облачного пароля — в движке.
// Enforcement: перед обработкой любого AdminAction сервер обязан проверить session.User.Role через AllowAdminAction.
package engine

import (
	"errors"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
	"github.com/89646128494le-svg/safegram-core/internal/store"
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

// SendMessageSigned — V2: ratchet + Ed25519 подпись.
func (c *Core) SendMessageSigned(sessionID uint64, msgType uint16, text string, sessionKey []byte, sendCounter *uint32, identityPriv []byte) ([]byte, error) {
	if len(sessionKey) != crypto.AESKeySize {
		return nil, crypto.ErrInvalidKey
	}
	step := *sendCounter
	msgKey := crypto.RatchetMessageKey(sessionKey, uint64(step))
	*sendCounter++
	plain := []byte(text)
	enc, err := crypto.EncryptGCM(msgKey, plain, nil)
	if err != nil {
		return nil, errors.Join(ErrEncrypt, err)
	}
	signedData := transport.SignedDataForPacket(msgType, sessionID, step, enc)
	sig, err := crypto.SignEd25519(identityPriv, signedData)
	if err != nil {
		return nil, err
	}
	return transport.PackSigned(msgType, sessionID, step, enc, sig)
}

// AllowAdminAction проверяет, может ли пользователь с данной ролью и идентификатором выполнить действие.
// Доступ к RoleOwner только у Lev (Master Access по SystemOwnerID/SystemOwnerUsername).
// Вызывать перед обработкой пакета типа AdminAction.
func AllowAdminAction(userRole, userID, username, action string) bool {
	return store.HasPermission(userRole, userID, username, action)
}

// ReceiveMessageSigned — V2: проверка подписи и расшифровка ratchet.
func (c *Core) ReceiveMessageSigned(data []byte, sessionKey []byte, identityPub []byte) (msgType uint16, plain []byte, err error) {
	if len(sessionKey) != crypto.AESKeySize {
		return 0, nil, crypto.ErrInvalidKey
	}
	typeID, sessionID, ratchetStep, payload, signature, err := transport.UnpackSigned(data)
	if err != nil {
		return 0, nil, err
	}
	signedData := transport.SignedDataForPacket(typeID, sessionID, ratchetStep, payload)
	if !crypto.VerifyEd25519(identityPub, signedData, signature) {
		return 0, nil, crypto.ErrSignatureInvalid
	}
	msgKey := crypto.RatchetMessageKey(sessionKey, uint64(ratchetStep))
	plain, err = crypto.DecryptGCM(msgKey, payload, nil)
	if err != nil {
		return 0, nil, errors.Join(ErrDecrypt, err)
	}
	return typeID, plain, nil
}
