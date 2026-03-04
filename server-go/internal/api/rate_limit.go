package api

import (
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     int
	window   time.Duration
}

type visitor struct {
	lastSeen time.Time
	count    int
}

func envRateLimit(defaultRate int) int {
	if s := os.Getenv("RATE_LIMIT_PER_MIN"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			return n
		}
	}
	return defaultRate
}

var limiter = &rateLimiter{
	visitors: make(map[string]*visitor),
	rate:     envRateLimit(800),
	window:   time.Minute,
}

func (rl *rateLimiter) getVisitor(ip string) *visitor {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		v = &visitor{
			lastSeen: time.Now(),
			count:    1,
		}
		rl.visitors[ip] = v
		return v
	}

	// Сбрасываем счетчик, если окно истекло
	if time.Since(v.lastSeen) > rl.window {
		v.count = 1
		v.lastSeen = time.Now()
		return v
	}

	v.count++
	return v
}

func (rl *rateLimiter) allow(ip string) bool {
	v := rl.getVisitor(ip)
	return v.count <= rl.rate
}

// RateLimitMiddleware ограничивает количество запросов (без блокировки IP)
func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.allow(ip) {
			c.JSON(429, gin.H{"error": "too_many_requests"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// AuthRateLimit более строгий лимит для аутентификации (AUTH_RATE_LIMIT — макс попыток за окно)
var authLimiter = &rateLimiter{
	visitors: make(map[string]*visitor),
	rate:     envAuthRateLimit(60),
	window:   time.Minute * 5,
}

func envAuthRateLimit(defaultRate int) int {
	if s := os.Getenv("AUTH_RATE_LIMIT"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			return n
		}
	}
	return defaultRate
}

func AuthRateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !authLimiter.allow(ip) {
			c.JSON(429, gin.H{"error": "too_many_attempts"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ResetAuthRateLimit сбрасывает лимит для IP (для разработки)
func ResetAuthRateLimit(ip string) {
	authLimiter.mu.Lock()
	defer authLimiter.mu.Unlock()
	delete(authLimiter.visitors, ip)
}

// ResetAllRateLimits сбрасывает все лимиты (для разработки)
func ResetAllRateLimits() {
	limiter.mu.Lock()
	limiter.visitors = make(map[string]*visitor)
	limiter.mu.Unlock()

	authLimiter.mu.Lock()
	authLimiter.visitors = make(map[string]*visitor)
	authLimiter.mu.Unlock()

	searchLimiter.mu.Lock()
	searchLimiter.visitors = make(map[string]*visitor)
	searchLimiter.mu.Unlock()
}

// SearchRateLimit: жёсткий лимит на поиск пользователей (анти-скрапинг), по userID.
var searchLimiter = &rateLimiter{
	visitors: make(map[string]*visitor),
	rate:     20,
	window:   time.Minute,
}

// SearchRateLimitMiddleware ограничивает поиск (users/search, /search) — 20 запросов/мин на пользователя.
func SearchRateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		key, _ := userID.(string)
		if key == "" {
			key = "ip:" + c.ClientIP()
		}
		if !searchLimiter.allow(key) {
			c.JSON(429, gin.H{"error": "too_many_requests", "detail": "search_limit"})
			c.Abort()
			return
		}
		c.Next()
	}
}

