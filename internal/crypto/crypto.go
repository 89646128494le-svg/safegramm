// Пакет crypto: обмен ключами Curve25519 (ECDH) и шифрование AES-256-GCM.
// Весь трафик сообщений — только в зашифрованном виде; ключи на сервере не хранятся.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"io"
)

const (
	AESKeySize   = 32
	GCMNonceSize = 12
	GCMTagSize   = 16
	HashSize     = sha256.Size
)

var (
	ErrInvalidKey       = errors.New("crypto: invalid key length")
	ErrInvalidNonce     = errors.New("crypto: invalid nonce length")
	ErrDecrypt          = errors.New("crypto: decryption failed")
	ErrInvalidInput     = errors.New("crypto: invalid input")
	ErrKeyGen           = errors.New("crypto: key generation failed")
	ErrSharedSecret     = errors.New("crypto: ECDH shared secret failed")
)

// KeyPair holds a Curve25519 private and public key.
type KeyPair struct {
	Private []byte
	Public  []byte
}

// GenerateKeyPair creates a new Curve25519 key pair for ECDH.
// Private is 32 bytes, Public is 32 bytes. Caller must not modify Private.
func GenerateKeyPair() (*KeyPair, error) {
	curve := ecdh.X25519()
	priv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, joinErr(ErrKeyGen, err)
	}
	pub := priv.PublicKey().Bytes()
	return &KeyPair{
		Private: priv.Bytes(),
		Public:  pub,
	}, nil
}

// SharedSecret performs ECDH with the local private key and peer's public key.
// Returns 32-byte shared secret. Use DeriveAESKey before using in AES-GCM.
func SharedSecret(privateKey, peerPublicKey []byte) ([]byte, error) {
	if len(privateKey) != 32 || len(peerPublicKey) != 32 {
		return nil, ErrInvalidKey
	}
	curve := ecdh.X25519()
	priv, err := curve.NewPrivateKey(privateKey)
	if err != nil {
		return nil, joinErr(ErrSharedSecret, err)
	}
	pub, err := curve.NewPublicKey(peerPublicKey)
	if err != nil {
		return nil, joinErr(ErrSharedSecret, err)
	}
	secret, err := priv.ECDH(pub)
	if err != nil {
		return nil, joinErr(ErrSharedSecret, err)
	}
	return secret, nil
}

// DeriveAESKey derives a 32-byte AES-256 key from shared secret using SHA-256.
// salt and info can be nil or used for context binding (e.g. "safegram-v1").
func DeriveAESKey(sharedSecret, salt, info []byte) []byte {
	if salt == nil {
		salt = []byte{}
	}
	if info == nil {
		info = []byte("safegram-aes256")
	}
	h := sha256.New()
	h.Write(sharedSecret)
	h.Write(salt)
	h.Write(info)
	return h.Sum(nil)[:AESKeySize]
}

// EncryptGCM encrypts plaintext with AES-256-GCM. Key must be 32 bytes.
// Nonce is generated randomly and prepended to the output (nonce || ciphertext || tag).
// additionalData is authenticated but not encrypted (can be nil).
func EncryptGCM(key, plaintext, additionalData []byte) ([]byte, error) {
	if len(key) != AESKeySize {
		return nil, ErrInvalidKey
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, GCMNonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	out := aead.Seal(nonce, nonce, plaintext, additionalData)
	return out, nil
}

// DecryptGCM decrypts ciphertext produced by EncryptGCM.
// Expects ciphertext = nonce || sealed. Key must be 32 bytes.
func DecryptGCM(key, ciphertext, additionalData []byte) ([]byte, error) {
	if len(key) != AESKeySize {
		return nil, ErrInvalidKey
	}
	if len(ciphertext) < GCMNonceSize+GCMTagSize {
		return nil, ErrDecrypt
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce, sealed := ciphertext[:GCMNonceSize], ciphertext[GCMNonceSize:]
	plain, err := aead.Open(nil, nonce, sealed, additionalData)
	if err != nil {
		return nil, ErrDecrypt
	}
	return plain, nil
}

// Hash256 returns SHA-256 digest of data (Layer 3 integrity).
func Hash256(data []byte) [HashSize]byte {
	return sha256.Sum256(data)
}

// VerifyHash returns true if SHA256(data) equals h (constant-time).
func VerifyHash(data []byte, h [HashSize]byte) bool {
	got := sha256.Sum256(data)
	return subtle.ConstantTimeCompare(got[:], h[:]) == 1
}

func joinErr(wrap, cause error) error {
	return errors.Join(wrap, cause)
}
