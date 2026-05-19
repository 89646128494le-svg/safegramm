package api

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	defaultMaxBodyBytes    = 10 << 20 // 10 MB для обычных запросов
	defaultDDoSReqPerMin   = 5000     // глобальный лимит запросов/мин с одного IP (не баним по 429)
	defaultViolationsToBan = 9999     // по умолчанию не банить по счётчику (только ручной бан в админке)
	defaultBanDurationMin  = 30       // минуты бана при ручном бане
	defaultWSConnsPerIP    = 10       // макс WebSocket соединений с одного IP
)

// ipBlocklist — только ручной бан через админку (BlockManual). Авто-бан по нарушениям отключён.
type ipBlocklist struct {
	mu         sync.RWMutex
	banned     map[string]time.Time
	violations map[string]*violationCount
	banDur     time.Duration
	toBan      int
}

type violationCount struct {
	count int
	seen  time.Time
}

func newIPBlocklist(banMinutes, violationsToBan int) *ipBlocklist {
	dur := time.Duration(banMinutes) * time.Minute
	if dur <= 0 {
		dur = defaultBanDurationMin * time.Minute
	}
	if violationsToBan <= 0 {
		violationsToBan = defaultViolationsToBan
	}
	return &ipBlocklist{
		banned:     make(map[string]time.Time),
		violations: make(map[string]*violationCount),
		banDur:     dur,
		toBan:      violationsToBan,
	}
}

func (b *ipBlocklist) isBanned(ip string) bool {
	b.mu.RLock()
	until, ok := b.banned[ip]
	b.mu.RUnlock()
	if !ok {
		return false
	}
	if time.Now().After(until) {
		b.mu.Lock()
		delete(b.banned, ip)
		delete(b.violations, ip)
		b.mu.Unlock()
		return false
	}
	return true
}

func (b *ipBlocklist) recordViolation(ip string) {
	// Авто-бан отключён: не добавляем IP в бан по счётчику нарушений
}

func (b *ipBlocklist) isWhitelisted(ip string) bool {
	wl := os.Getenv("SECURITY_IP_WHITELIST")
	if wl == "" {
		return false
	}
	for _, s := range strings.Split(wl, ",") {
		s = strings.TrimSpace(s)
		if s == ip {
			return true
		}
	}
	return false
}

// ListBanned возвращает список IP, которые сейчас в бане (время ещё не истекло).
func (b *ipBlocklist) ListBanned() []string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	now := time.Now()
	out := make([]string, 0, len(b.banned))
	for ip, until := range b.banned {
		if now.Before(until) {
			out = append(out, ip)
		}
	}
	return out
}

// Unblock снимает бан с IP.
func (b *ipBlocklist) Unblock(ip string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.banned, ip)
	delete(b.violations, ip)
}

// BlockManual добавляет IP в бан на стандартный срок (для админки).
func (b *ipBlocklist) BlockManual(ip string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.banned[ip] = time.Now().Add(b.banDur)
	delete(b.violations, ip)
}

var globalBlocklist = newIPBlocklist(envInt("SECURITY_BAN_MINUTES", defaultBanDurationMin), envInt("SECURITY_VIOLATIONS_TO_BAN", defaultViolationsToBan))

func envInt(key string, defaultVal int) int {
	if s := os.Getenv(key); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			return n
		}
	}
	return defaultVal
}

type ddosVisitor struct {
	count       int
	windowStart time.Time
}

// globalDDoS — жёсткий лимит запросов в минуту с одного IP (защита от флуда).
type globalDDoS struct {
	mu     sync.RWMutex
	perIP  map[string]*ddosVisitor
	limit  int
	window time.Duration
}

var globalDDoSlimiter = &globalDDoS{
	perIP:  make(map[string]*ddosVisitor),
	limit:  envInt("SECURITY_GLOBAL_RATE_PER_MIN", defaultDDoSReqPerMin),
	window: time.Minute,
}

func (g *globalDDoS) allow(ip string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	now := time.Now()
	v, ok := g.perIP[ip]
	if !ok {
		g.perIP[ip] = &ddosVisitor{count: 1, windowStart: now}
		return true
	}
	if now.Sub(v.windowStart) > g.window {
		v.count = 1
		v.windowStart = now
		return true
	}
	v.count++
	return v.count <= g.limit
}

func (g *globalDDoS) recordReject(ip string) {
	// Авто-блокировка отключена: не добавляем IP в блоклист
}

// SecurityMiddleware — порядок: 1) блоклист, 2) глобальный rate limit, 3) лимит тела.
// Вешать первым после Recovery/CORS, до остальных хендлеров.
// Для тестов: DISABLE_DDOS=true или SECURITY_DISABLED=true — отключает DDoS/rate limit/блоклист.
func SecurityMiddleware() gin.HandlerFunc {
	maxBody := int64(envInt("SECURITY_MAX_BODY_MB", 10) << 20)
	if maxBody <= 0 {
		maxBody = defaultMaxBodyBytes
	}
	return func(c *gin.Context) {
		if IsDDoSDisabled() {
			c.Next()
			return
		}
		path := c.Request.URL.Path
		if path == "/health" || path == "/metrics" {
			c.Next()
			return
		}
		ip := c.ClientIP()
		if globalBlocklist.isWhitelisted(ip) {
			c.Next()
			return
		}
		if globalBlocklist.isBanned(ip) {
			c.Header("Retry-After", strconv.Itoa(envInt("SECURITY_BAN_MINUTES", defaultBanDurationMin)*60))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "ip_temporarily_blocked"})
			return
		}
		if !globalDDoSlimiter.allow(ip) {
			// Не записываем нарушение — только 429, без блокировки IP
			retryAfterSec := int(globalDDoSlimiter.window.Seconds())
			c.Header("Retry-After", strconv.Itoa(retryAfterSec))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":         "too_many_requests",
				"detail":        "security_global_rate_limit",
				"retryAfterSec": retryAfterSec,
			})
			return
		}
		if c.Request.Body != nil && c.Request.ContentLength > maxBody {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request_body_too_large"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBody)
		c.Next()
		// Не баним IP по 429 — убрано, чтобы не блокировать при обычном использовании
	}
}

// wsConnLimit — макс одновременных WebSocket соединений с одного IP.
type wsConnLimit struct {
	mu    sync.Mutex
	perIP map[string]int
	max   int
}

var wsConnLimiter = &wsConnLimit{
	perIP: make(map[string]int),
	max:   envInt("SECURITY_WS_CONNS_PER_IP", defaultWSConnsPerIP),
}

func (w *wsConnLimit) allow(ip string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	n := w.perIP[ip]
	return n < w.max
}

func (w *wsConnLimit) acquire(ip string) (release func()) {
	w.mu.Lock()
	w.perIP[ip]++
	w.mu.Unlock()
	return func() {
		w.mu.Lock()
		if w.perIP[ip] > 0 {
			w.perIP[ip]--
		}
		if w.perIP[ip] == 0 {
			delete(w.perIP, ip)
		}
		w.mu.Unlock()
	}
}

// RecordSecurityViolation больше не используется — авто-блокировка IP отключена.
// Блокировка только через админку (BlockManual / Unblock).
func RecordSecurityViolation(ip string) {}

// IsDDoSDisabled возвращает true, если защита отключена (для тестов).
func IsDDoSDisabled() bool {
	return os.Getenv("DISABLE_DDOS") == "true" || os.Getenv("DISABLE_DDOS") == "1" ||
		os.Getenv("SECURITY_DISABLED") == "true" || os.Getenv("SECURITY_DISABLED") == "1"
}
