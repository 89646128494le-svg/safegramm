package transport

import (
	"sync"
	"time"
)

const (
	PacketViolationsBeforeBan = 3
	BlacklistDuration         = 10 * time.Minute
)

type ban struct {
	until time.Time
}

// Blacklist блокирует IP на 10 минут после 3+ нарушений структуры пакета.
type Blacklist struct {
	mu         sync.Mutex
	banned     map[string]ban
	violations map[string]int
}

// NewBlacklist создаёт чёрный список.
func NewBlacklist() *Blacklist {
	b := &Blacklist{
		banned:     make(map[string]ban),
		violations: make(map[string]int),
	}
	go b.cleanup()
	return b
}

// RecordPacketViolation увеличивает счётчик нарушений для ip. После 3 раз добавляет в бан.
func (b *Blacklist) RecordPacketViolation(ip string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.violations[ip]++
	if b.violations[ip] >= PacketViolationsBeforeBan {
		b.banned[ip] = ban{until: time.Now().Add(BlacklistDuration)}
		delete(b.violations, ip)
	}
}

// BanIP вручную добавляет IP в бан на BlacklistDuration (для админ-панели).
func (b *Blacklist) BanIP(ip string) {
	if ip == "" {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.banned[ip] = ban{until: time.Now().Add(BlacklistDuration)}
	delete(b.violations, ip)
}

// IsBlacklisted возвращает true, если ip в бане.
func (b *Blacklist) IsBlacklisted(ip string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	v, ok := b.banned[ip]
	if !ok {
		return false
	}
	if time.Now().After(v.until) {
		delete(b.banned, ip)
		return false
	}
	return true
}

// ListBanned возвращает список IP, находящихся в бане (для админки).
func (b *Blacklist) ListBanned() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	out := make([]string, 0, len(b.banned))
	for ip, v := range b.banned {
		if now.Before(v.until) {
			out = append(out, ip)
		}
	}
	return out
}

func (b *Blacklist) cleanup() {
	tick := time.NewTicker(1 * time.Minute)
	for range tick.C {
		b.mu.Lock()
		now := time.Now()
		for ip, v := range b.banned {
			if now.After(v.until) {
				delete(b.banned, ip)
			}
		}
		b.mu.Unlock()
	}
}
