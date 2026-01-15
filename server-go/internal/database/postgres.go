package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(databaseURL string) (*gorm.DB, error) {
	// Подключаемся напрямую через GORM с DSN
	// Используем postgres.Open вместо postgres.New для избежания проблем с параметрами
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		PrepareStmt: false, // Отключаем prepared statements для избежания проблем с параметрами
	})

	if err != nil {
		return nil, fmt.Errorf("failed to connect via GORM: %w", err)
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

