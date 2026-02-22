// Утилита для полной очистки БД (без входа в приложение).
// Запуск из папки server-go: go run ./cmd/clear-db
// Использует DATABASE_URL из .env или sqlite:safegram.db по умолчанию.
package main

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"safegram-server/internal/config"
	"safegram-server/internal/database"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	dbURL := cfg.DatabaseURL
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		dbURL = "sqlite:safegram.db"
	}
	if strings.Contains(dbURL, "localhost") && (strings.Contains(dbURL, "5432") || strings.Contains(dbURL, "safegram")) {
		dbURL = "sqlite:safegram.db"
		log.Println("Using SQLite (safegram.db)")
	}

	db, err := database.Connect(dbURL)
	if err != nil {
		log.Fatalf("Connect: %v", err)
	}
	defer database.Close(db)

	if err := database.ClearAll(db); err != nil {
		log.Fatalf("ClearAll: %v", err)
	}
	log.Println("База данных очищена. Можешь заново зарегистрироваться — первый пользователь или логин 'lev' получит владельца.")
}
