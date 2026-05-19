package config

import (
	"log"
	"os"
	"strings"
)

type Config struct {
	Port        string
	JWTSecret   string
	DatabaseURL string
	RedisURL    string
	NodeEnv     string
	WebhookURL  string
}

const defaultJWT = "dev-secret-change-in-production"

func Load() *Config {
	jwt := getEnv("JWT_SECRET", defaultJWT)
	nodeEnv := getEnv("NODE_ENV", "development")
	if nodeEnv == "production" && (jwt == "" || jwt == defaultJWT) {
		log.Fatal("JWT_SECRET must be set to a secure value in production (do not use default)")
	}
	return &Config{
		Port:        getEnv("PORT", "8080"),
		JWTSecret:   jwt,
		DatabaseURL: getEnv("DATABASE_URL", "postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "localhost:6379"),
		NodeEnv:     nodeEnv,
		WebhookURL:  getEnv("WEBHOOK_URL", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return defaultValue
}
