package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type userRow struct {
	ID       string
	Username string
	PinHash  string
	PinSalt  string
}

func main() {
	username := flag.String("username", "", "username to clear cloud PIN for")
	flag.Parse()

	targetUsername := strings.TrimSpace(*username)
	if targetUsername == "" {
		log.Fatal("usage: go run ./cmd/remove-pin --username lev")
	}

	_ = godotenv.Load()
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}

	var user userRow
	if err := db.Table("users").
		Select("id", "username", "pin_hash", "pin_salt").
		Where("LOWER(username) = LOWER(?)", targetUsername).
		First(&user).Error; err != nil {
		log.Fatalf("find user %q: %v", targetUsername, err)
	}

	if strings.TrimSpace(user.PinHash) == "" && strings.TrimSpace(user.PinSalt) == "" {
		fmt.Printf("cloud PIN already removed for %s (%s)\n", user.Username, user.ID)
		return
	}

	if err := db.Table("users").
		Where("id = ?", user.ID).
		Updates(map[string]interface{}{
			"pin_hash": "",
			"pin_salt": "",
		}).Error; err != nil {
		log.Fatalf("clear cloud PIN: %v", err)
	}

	fmt.Printf("cloud PIN removed for %s (%s)\n", user.Username, user.ID)
}
