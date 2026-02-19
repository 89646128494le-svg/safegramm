package transport

import (
	"sync"
	"time"
)

// HandshakeRateLimit — не более 5 попыток handshake в секунду с одного IP (Token Bucket).
const (
	HandshakeTokensPerSecond = 5
	HandshakeBucketSize      = 5
)

type bucket struct {
	tokens float64
	last   time.Time
}

// HandshakeLimiter ограничивает частоту handshake по IP (Token Bucket).
type HandshakeLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64
	cap     float64
}

// NewHandshakeLimiter создаёт лимитер: rate токенов в секунду, cap — макс. токенов.
func NewHandshakeLimiter(rate, cap float64) *HandshakeLimiter {
	if rate <= 0 {
		rate = HandshakeTokensPerSecond
	}
	if cap <= 0 {
		cap = HandshakeBucketSize
	}
	h := &HandshakeLimiter{
		buckets: make(map[string]*bucket),
		rate:    rate,
		cap:     cap,
	}
	go h.cleanup()
	return h
}

// AllowHandshake потребляет один токен для ip. Возвращает false, если лимит исчерпан.
func (h *HandshakeLimiter) AllowHandshake(ip string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	b, ok := h.buckets[ip]
	if !ok {
		b = &bucket{tokens: h.cap - 1, last: now}
		h.buckets[ip] = b
		return true
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens += elapsed * h.rate
	if b.tokens > h.cap {
		b.tokens = h.cap
	}
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// SetRate обновляет лимит токенов в секунду (для админки).
func (h *HandshakeLimiter) SetRate(rate float64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if rate > 0 {
		h.rate = rate
	}
}

// SetCap обновляет ёмкость ведра (для админки).
func (h *HandshakeLimiter) SetCap(cap float64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if cap > 0 {
		h.cap = cap
	}
}

func (h *HandshakeLimiter) cleanup() {
	tick := time.NewTicker(2 * time.Minute)
	for range tick.C {
		h.mu.Lock()
		for ip, b := range h.buckets {
			if time.Since(b.last) > 2*time.Minute {
				delete(h.buckets, ip)
			}
		}
		h.mu.Unlock()
	}
}
