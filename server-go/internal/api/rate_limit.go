package api

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     int           // количество запросов
	window   time.Duration // временное окно
}

type visitor struct {
	lastSeen time.Time
	count    int
}

var limiter = &rateLimiter{
	visitors: make(map[string]*visitor),
	rate:     100, // 100 запросов
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

// RateLimitMiddleware ограничивает количество запросов
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

// AuthRateLimit более строгий лимит для аутентификации
var authLimiter = &rateLimiter{
	visitors: make(map[string]*visitor),
	rate:     30, // 30 попыток (увеличено для разработки и нормального использования)
	window:   time.Minute * 5,
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
}

