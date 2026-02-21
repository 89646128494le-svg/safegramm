package database

import (
	"fmt"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Connect(databaseURL string) (*gorm.DB, error) {
	if databaseURL == "" {
		databaseURL = "sqlite:safegram.db"
	}
	config := &gorm.Config{PrepareStmt: false}

	if strings.HasPrefix(databaseURL, "sqlite:") {
		path := strings.TrimPrefix(databaseURL, "sqlite:")
		if path == "" {
			path = "safegram.db"
		}
		db, err := gorm.Open(sqlite.Open(path), config)
		if err != nil {
			return nil, fmt.Errorf("failed to connect via SQLite: %w", err)
		}
		return db, nil
	}

	db, err := gorm.Open(postgres.Open(databaseURL), config)
	if err == nil {
		return db, nil
	}
	db2, sqliteErr := gorm.Open(sqlite.Open("safegram.db"), config)
	if sqliteErr != nil {
		return nil, fmt.Errorf("postgres failed (%v), sqlite fallback failed: %w", err, sqliteErr)
	}
	return db2, nil
}

func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}