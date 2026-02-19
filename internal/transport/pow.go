package transport

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"sync"
	"time"
)

// Proof-of-Work: при подозрительной активности сервер шлёт задачу (найти nonce с N ведущими нулями в hash).
// Клиент решает на CPU и присылает решение; только тогда сервер выделяет ресурсы.

const (
	PowChallengeByte   = 0x50 // 'P' — сервер шлёт PoW challenge
	PowSolutionTimeout = 15 * time.Second
)

var (
	ErrPowInvalidSolution = errors.New("transport: invalid PoW solution")
	ErrPowExpired          = errors.New("transport: PoW challenge expired")
)

// Challenge: 1 byte type 'P' || 2 bytes difficulty (big-endian) || 8 bytes nonce || 4 bytes salt.
const (
	PowChallengeHeaderSize = 1 + 2 + 8 + 4
	PowSolutionSize        = 8
)

// PowChallenge создаёт задачу: hash(salt|nonce|solution) должен иметь не менее difficulty ведущих нулей (байт).
func PowChallenge(difficulty uint16, nonce uint64, salt []byte) []byte {
	if len(salt) < 4 {
		s := [4]byte{}
		copy(s[:], salt)
		salt = s[:]
	}
	if len(salt) > 4 {
		salt = salt[:4]
	}
	buf := make([]byte, PowChallengeHeaderSize)
	buf[0] = PowChallengeByte
	binary.BigEndian.PutUint16(buf[1:3], difficulty)
	binary.BigEndian.PutUint64(buf[3:11], nonce)
	copy(buf[11:15], salt)
	return buf
}

// PowVerify проверяет solution для challenge (те же difficulty, nonce, salt). Возвращает nil при успехе.
func PowVerify(challenge []byte, solution uint64) error {
	if len(challenge) < PowChallengeHeaderSize {
		return ErrPowInvalidSolution
	}
	if challenge[0] != PowChallengeByte {
		return ErrPowInvalidSolution
	}
	difficulty := binary.BigEndian.Uint16(challenge[1:3])
	nonce := binary.BigEndian.Uint64(challenge[3:11])
	salt := challenge[11:15]
	input := make([]byte, 4+8+8)
	copy(input[0:4], salt)
	binary.BigEndian.PutUint64(input[4:12], nonce)
	binary.BigEndian.PutUint64(input[12:20], solution)
	h := sha256.Sum256(input)
	zeros := 0
	for _, b := range h {
		if b != 0 {
			break
		}
		zeros++
	}
	if zeros < int(difficulty) {
		return ErrPowInvalidSolution
	}
	return nil
}

// PowSolver находит solution для заданного challenge (перебор nonce). Для клиента.
func PowSolve(challenge []byte) (uint64, error) {
	if len(challenge) < PowChallengeHeaderSize || challenge[0] != PowChallengeByte {
		return 0, ErrPowInvalidSolution
	}
	difficulty := binary.BigEndian.Uint16(challenge[1:3])
	nonce := binary.BigEndian.Uint64(challenge[3:11])
	salt := make([]byte, 4)
	copy(salt, challenge[11:15])
	input := make([]byte, 4+8+8)
	copy(input[0:4], salt)
	binary.BigEndian.PutUint64(input[4:12], nonce)
	for sol := uint64(0); sol < 1<<63; sol++ {
		binary.BigEndian.PutUint64(input[12:20], sol)
		h := sha256.Sum256(input)
		zeros := 0
		for _, b := range h {
			if b != 0 {
				break
			}
			zeros++
		}
		if zeros >= int(difficulty) {
			return sol, nil
		}
	}
	return 0, ErrPowInvalidSolution
}

// Active challenges for timeout (server-side).
type powChallenges struct {
	mu    sync.Mutex
	until map[string]time.Time
}

func newPowChallenges() *powChallenges {
	return &powChallenges{until: make(map[string]time.Time)}
}

func (p *powChallenges) register(ip string) {
	p.mu.Lock()
	p.until[ip] = time.Now().Add(PowSolutionTimeout)
	p.mu.Unlock()
}

func (p *powChallenges) consume(ip string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	t, ok := p.until[ip]
	if !ok {
		return true
	}
	if time.Now().After(t) {
		delete(p.until, ip)
		return false
	}
	delete(p.until, ip)
	return true
}
