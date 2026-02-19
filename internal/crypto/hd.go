// Пакет crypto: иерархическое детерминированное выведение ключей из сид-фразы (HD).
// Все ключи шифрования выводятся из одной фразы; приватный ключ никогда не покидает устройство.
package crypto

import (
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/sha512"
	"io"

	"golang.org/x/crypto/hkdf"
)

const (
	IdentityKeyPath = "safegram-ed25519-identity-v1"
	SessionKeyPath  = "safegram-x25519-session-v1"
)

// SeedToIdentityKey выводит из seed (64 байта от MnemonicToSeed) пару Ed25519.
// Возвращает (privateKey 64 bytes, publicKey 32 bytes). Приватный ключ только на устройстве.
func SeedToIdentityKey(seed []byte) (priv []byte, pub []byte, err error) {
	if len(seed) < 32 {
		return nil, nil, ErrSeedTooShort
	}
	hk := hkdf.New(sha512.New, seed, nil, []byte(IdentityKeyPath))
	keySeed := make([]byte, 32)
	if _, err = io.ReadFull(hk, keySeed); err != nil {
		return nil, nil, err
	}
	edPriv := ed25519.NewKeyFromSeed(keySeed)
	return edPriv, edPriv[32:], nil
}

// SeedToSessionKeyPair выводит из seed первый сессионный ключ ECDH (X25519).
// sessionIndex можно использовать для нескольких сессий (0, 1, 2...).
func SeedToSessionKeyPair(seed []byte, sessionIndex uint32) (*KeyPair, error) {
	if len(seed) < 32 {
		return nil, ErrSeedTooShort
	}
	info := []byte(SessionKeyPath)
	// привязка к индексу сессии
	info = append(info, byte(sessionIndex>>24), byte(sessionIndex>>16), byte(sessionIndex>>8), byte(sessionIndex))
	hk := hkdf.New(sha512.New, seed, nil, info)
	privBytes := make([]byte, 32)
	if _, err := io.ReadFull(hk, privBytes); err != nil {
		return nil, err
	}
	// X25519 clamping (RFC 7748)
	clamp25519(privBytes)
	curve := ecdh.X25519()
	priv, err := curve.NewPrivateKey(privBytes)
	if err != nil {
		return nil, err
	}
	return &KeyPair{
		Private: priv.Bytes(),
		Public:  priv.PublicKey().Bytes(),
	}, nil
}

func clamp25519(b []byte) {
	if len(b) < 32 {
		return
	}
	b[0] &= 248
	b[31] &= 127
	b[31] |= 64
}

// GenerateMnemonicEntropyAndWords генерирует 32 байта энтропии и возвращает 24 слова (BIP39-style).
// Использует GenerateEntropy из mnemonic.go; seed получается через MnemonicToSeed на устройстве.
func GenerateMnemonicEntropyAndWords() (entropy []byte, words []string, err error) {
	entropy, err = GenerateEntropy()
	if err != nil {
		return nil, nil, err
	}
	words, err = EntropyToMnemonic(entropy)
	if err != nil {
		return nil, nil, err
	}
	return entropy, words, nil
}
