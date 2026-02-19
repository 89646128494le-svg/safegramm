package transport

import (
	"sync"
)

// DDoSSettings — настройки DDoS (rate limit и сложность PoW). Админ меняет через API.
type DDoSSettings struct {
	mu            sync.RWMutex
	RatePerSec    float64 // токенов в секунду на IP (handshake)
	BucketCap     float64 // макс. токенов в ведре
	PoWDifficulty uint16  // число ведущих нулевых байт в hash (1–4 разумно)
}

// NewDDoSSettings возвращает настройки по умолчанию.
func NewDDoSSettings() *DDoSSettings {
	return &DDoSSettings{
		RatePerSec:    HandshakeTokensPerSecond,
		BucketCap:     HandshakeBucketSize,
		PoWDifficulty: 2,
	}
}

func (d *DDoSSettings) Get() (rate, cap float64, pow uint16) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.RatePerSec, d.BucketCap, d.PoWDifficulty
}

func (d *DDoSSettings) Set(rate, cap float64, pow uint16) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if rate > 0 {
		d.RatePerSec = rate
	}
	if cap > 0 {
		d.BucketCap = cap
	}
	if pow <= 4 {
		d.PoWDifficulty = pow
	}
}
