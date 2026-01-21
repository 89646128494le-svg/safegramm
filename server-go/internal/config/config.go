package config

import (
	"os"
)

type Config struct {
	Port        string
	JWTSecret   string
	DatabaseURL string
	RedisURL    string
	NodeEnv     string
	WebhookURL  string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "localhost:6379"),
		NodeEnv:     getEnv("NODE_ENV", "development"),
		WebhookURL:  getEnv("WEBHOOK_URL", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

