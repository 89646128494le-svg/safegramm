package database

import (
	"fmt"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const (
	MaxOpenConns    = 50
	MaxIdleConns    = 20
	ConnMaxLifetime = time.Minute * 5
)

func Connect(databaseURL string) (*gorm.DB, error) {
	if databaseURL == "" {
		databaseURL = "sqlite:safegram.db"
	}
	config := &gorm.Config{PrepareStmt: true}

	if strings.HasPrefix(databaseURL, "sqlite:") {
		path := strings.TrimPrefix(databaseURL, "sqlite:")
		if path == "" {
			path = "safegram.db"
		}
		// glebarez/sqlite — pure Go, работает без CGO (в т.ч. на сервере)
		db, err := gorm.Open(sqlite.Open(path), config)
		if err != nil {
			return nil, fmt.Errorf("failed to connect via SQLite: %w", err)
		}
		return db, nil
	}

	db, err := gorm.Open(postgres.Open(databaseURL), config)
	if err != nil {
		sqliteDB, sqliteErr := gorm.Open(sqlite.Open("safegram.db"), config)
		if sqliteErr != nil {
			return nil, fmt.Errorf("postgres failed (%v), sqlite fallback failed: %w", err, sqliteErr)
		}
		return sqliteDB, nil
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(MaxOpenConns)
		sqlDB.SetMaxIdleConns(MaxIdleConns)
		sqlDB.SetConnMaxLifetime(ConnMaxLifetime)
	}
	return db, nil
}

func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
