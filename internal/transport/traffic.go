package transport

import (
	"sync"
)

const maxTrafficLog = 50

// TrafficLog — кольцевой буфер последних IP, пытавшихся подключиться (для админки).
type TrafficLog struct {
	mu   sync.RWMutex
	ips  []string
	head int
	len  int
}

// NewTrafficLog создаёт лог на 50 записей.
func NewTrafficLog() *TrafficLog {
	return &TrafficLog{ips: make([]string, maxTrafficLog)}
}

// Push добавляет IP в лог (вызывать при каждом Accept/попытке подключения).
func (t *TrafficLog) Push(ip string) {
	if ip == "" {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.ips[t.head] = ip
	t.head = (t.head + 1) % maxTrafficLog
	if t.len < maxTrafficLog {
		t.len++
	}
}

// Last возвращает последние N IP (новые первые).
func (t *TrafficLog) Last(n int) []string {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if n <= 0 || t.len == 0 {
		return nil
	}
	if n > t.len {
		n = t.len
	}
	out := make([]string, n)
	for i := 0; i < n; i++ {
		idx := (t.head - 1 - i + maxTrafficLog) % maxTrafficLog
		out[i] = t.ips[idx]
	}
	return out
}
