// Double Ratchet (Signal-style): смена ключей после каждого сообщения.
// Состояние хранится только в памяти; приватные ключи не сериализуются.
package crypto

import (
	"crypto/rand"
	"encoding/binary"
	"io"
	"sync"
)

const (
	RatchetInfoSend  = "safegram-dr-send-v1"
	RatchetInfoRecv  = "safegram-dr-recv-v1"
	RatchetMaxSkip   = 1000
)

// State — состояние Double Ratchet. Все ключи только в RAM.
type State struct {
	mu sync.Mutex

	// DH: наша пара ключей (приватный только в памяти)
	ourPrivate   []byte
	ourPublic    []byte
	peerPublic   []byte
	sharedSecret []byte

	// Цепи: ключ цепи и счётчики
	sendChainKey []byte
	sendNs       uint64
	recvChainKey []byte
	recvNr       uint64

	// Пропущенные сообщения (для out-of-order)
	skippedKeys map[uint64][]byte
}

// NewState создаёт состояние из shared secret (например, из ECDH при handshake).
// Приватные ключи не сохраняются в State после инициализации, только производные.
func NewState(sharedSecret []byte) (*State, error) {
	if len(sharedSecret) < 32 {
		sharedSecret = DeriveAESKey(sharedSecret, nil, []byte("safegram-dr-init"))
	}
	sendRoot := DeriveAESKey(sharedSecret, nil, []byte(RatchetInfoSend))
	recvRoot := DeriveAESKey(sharedSecret, nil, []byte(RatchetInfoRecv))
	return &State{
		sharedSecret: sharedSecret,
		sendChainKey: sendRoot,
		sendNs:       0,
		recvChainKey: recvRoot,
		recvNr:       0,
		skippedKeys:  make(map[uint64][]byte),
	}, nil
}

// InitFromKeys инициализирует состояние из нашей пары ключей и публичного ключа пира.
// Выполняет ECDH и заполняет цепи. Приватный ключ остаётся только в аргументе (caller zeroes).
func InitFromKeys(ourPrivate, ourPublic, peerPublic []byte) (*State, error) {
	secret, err := SharedSecret(ourPrivate, peerPublic)
	if err != nil {
		return nil, err
	}
	st, err := NewState(secret)
	if err != nil {
		return nil, err
	}
	st.ourPrivate = ourPrivate
	st.ourPublic = ourPublic
	st.peerPublic = peerPublic
	return st, nil
}

// Encrypt шифрует сообщение и продвигает send-цепь (новый ключ на каждое сообщение).
func (s *State) Encrypt(plaintext, ad []byte) (ciphertext []byte, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	msgKey := RatchetMessageKey(s.sendChainKey, s.sendNs)
	s.sendNs++

	// Следующий chain key (KDF)
	step := make([]byte, 8)
	binary.LittleEndian.PutUint64(step, s.sendNs)
	s.sendChainKey = DeriveAESKey(s.sendChainKey, step, []byte("chain"))

	ciphertext, err = EncryptGCM(msgKey, plaintext, ad)
	if err != nil {
		s.sendNs--
		return nil, err
	}

	// Префикс: номер сообщения (8 байт) для получателя
	prefix := make([]byte, 8)
	binary.LittleEndian.PutUint64(prefix, s.sendNs-1)
	return append(prefix, ciphertext...), nil
}

// Decrypt расшифровывает сообщение и продвигает recv-цепь. Поддерживает out-of-order (skip).
func (s *State) Decrypt(ciphertext, ad []byte) (plaintext []byte, err error) {
	if len(ciphertext) < 8+GCMNonceSize+GCMTagSize {
		return nil, ErrDecrypt
	}
	msgNum := binary.LittleEndian.Uint64(ciphertext[:8])
	payload := ciphertext[8:]

	s.mu.Lock()
	defer s.mu.Unlock()

	var msgKey []byte
	if msgNum == s.recvNr {
		msgKey = RatchetMessageKey(s.recvChainKey, s.recvNr)
		s.recvNr++
		step := make([]byte, 8)
		binary.LittleEndian.PutUint64(step, s.recvNr)
		s.recvChainKey = DeriveAESKey(s.recvChainKey, step, []byte("chain"))
	} else if msgNum > s.recvNr {
		if msgNum-s.recvNr > RatchetMaxSkip {
			s.mu.Unlock()
			return nil, ErrDecrypt
		}
		if mk, ok := s.skippedKeys[msgNum]; ok {
			msgKey = mk
			delete(s.skippedKeys, msgNum)
		} else {
			for n := s.recvNr; n < msgNum; n++ {
				mk := RatchetMessageKey(s.recvChainKey, n)
				s.skippedKeys[n] = mk
				step := make([]byte, 8)
				binary.LittleEndian.PutUint64(step, n+1)
				s.recvChainKey = DeriveAESKey(s.recvChainKey, step, []byte("chain"))
			}
			msgKey = RatchetMessageKey(s.recvChainKey, msgNum)
			s.recvNr = msgNum + 1
			step := make([]byte, 8)
			binary.LittleEndian.PutUint64(step, s.recvNr)
			s.recvChainKey = DeriveAESKey(s.recvChainKey, step, []byte("chain"))
		}
	} else {
		if mk, ok := s.skippedKeys[msgNum]; ok {
			msgKey = mk
			delete(s.skippedKeys, msgNum)
		} else {
			s.mu.Unlock()
			return nil, ErrDecrypt
		}
	}
	s.mu.Unlock()

	plaintext, err = DecryptGCM(msgKey, payload, ad)
	if err != nil {
		return nil, err
	}
	return plaintext, nil
}

// Zero обнуляет все ключи в памяти (вызвать при уничтожении сессии).
func (s *State) Zero() {
	s.mu.Lock()
	defer s.mu.Unlock()
	zeroBytes(s.ourPrivate)
	zeroBytes(s.ourPublic)
	zeroBytes(s.peerPublic)
	zeroBytes(s.sharedSecret)
	zeroBytes(s.sendChainKey)
	zeroBytes(s.recvChainKey)
	for _, k := range s.skippedKeys {
		zeroBytes(k)
	}
	s.skippedKeys = nil
}

func zeroBytes(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// GenerateEphemeralKeyPair генерирует временную пару для DH. Приватный ключ — только в RAM.
func GenerateEphemeralKeyPair() (priv, pub []byte, err error) {
	kp, err := GenerateKeyPair()
	if err != nil {
		return nil, nil, err
	}
	return kp.Private, kp.Public, nil
}

// RandRead обёртка для crypto/rand (для тестов можно подменить).
var RandRead = rand.Read

func init() {
	RandRead = rand.Read
	_ = io.Discard
}
