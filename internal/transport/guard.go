package transport

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"time"
)

// Guard объединяет rate limit, blacklist, PoW и traffic log для защиты TCP handshake.
type Guard struct {
	Limiter   *HandshakeLimiter
	Blacklist *Blacklist
	Traffic   *TrafficLog
	DDOS      *DDoSSettings
	powUntil  *powChallenges
}

// NewGuard создаёт Guard с дефолтными лимитами (5/sec, бан 10 мин после 3 нарушений).
func NewGuard() *Guard {
	cfg := NewDDoSSettings()
	rate, cap, _ := cfg.Get()
	lim := NewHandshakeLimiter(rate, cap)
	return &Guard{
		Limiter:   lim,
		Blacklist: NewBlacklist(),
		Traffic:   NewTrafficLog(),
		DDOS:      cfg,
		powUntil:  newPowChallenges(),
	}
}

// HandshakeReadDeadline — таймаут на чтение публичного ключа клиента (2 сек).
const HandshakeReadDeadline = 2 * time.Second

// AllowHandshake возвращает true, если соединение допускается до handshake (не в бане, лимит не исчерпан).
func (g *Guard) AllowHandshake(ip string) bool {
	if g.Blacklist.IsBlacklisted(ip) {
		return false
	}
	return g.Limiter.AllowHandshake(ip)
}

// RequirePoW возвращает true, если лимит исчерпан и нужно требовать PoW (подозрительная активность).
func (g *Guard) RequirePoW(ip string) bool {
	if g.Blacklist.IsBlacklisted(ip) {
		return false
	}
	return !g.Limiter.AllowHandshake(ip)
}

// SendPowChallenge отправляет клиенту challenge (1 + 2 + 8 + 4 = 15 bytes). difficulty 2 = 2 ведущих нуля в hash.
// Возвращает отправленный challenge для передачи в ReadPowSolution.
func (g *Guard) SendPowChallenge(conn net.Conn, difficulty uint16) (challenge []byte, err error) {
	if difficulty < 1 {
		_, _, difficulty = g.DDOS.Get()
		if difficulty < 1 {
			difficulty = 2
		}
	}
	var n [8]byte
	if _, err := rand.Read(n[:]); err != nil {
		return nil, err
	}
	nonce := binary.BigEndian.Uint64(n[:])
	salt := make([]byte, 4)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	challenge = PowChallenge(difficulty, nonce, salt)
	_, err = conn.Write(challenge)
	return challenge, err
}

// ReadPowSolution читает 8 байт solution с дедлайном PowSolutionTimeout.
func (g *Guard) ReadPowSolution(conn net.Conn, challenge []byte, ip string) (bool, error) {
	g.powUntil.register(ip)
	_ = conn.SetReadDeadline(time.Now().Add(PowSolutionTimeout))
	solBuf := make([]byte, PowSolutionSize)
	if _, err := io.ReadFull(conn, solBuf); err != nil {
		return false, err
	}
	_ = conn.SetReadDeadline(time.Time{})
	solution := binary.BigEndian.Uint64(solBuf)
	if err := PowVerify(challenge, solution); err != nil {
		return false, err
	}
	if !g.powUntil.consume(ip) {
		return false, ErrPowExpired
	}
	return true, nil
}


// RecordPacketViolation увеличивает счётчик нарушений пакета для ip; при 3+ — бан на 10 мин.
func (g *Guard) RecordPacketViolation(ip string) {
	g.Blacklist.RecordPacketViolation(ip)
}

// IsPacketStructureError возвращает true, если err связана с нарушением структуры пакета (для учёта в blacklist).
func IsPacketStructureError(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrPacketTooShort) || errors.Is(err, ErrChecksum)
}

