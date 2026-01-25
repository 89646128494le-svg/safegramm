package models

import (
	"time"
)

// MaintenanceMode модель для хранения информации о технических работах
type MaintenanceMode struct {
	ID        string    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	IsActive  bool      `json:"isActive" gorm:"default:false;index"`
	Timestamp string    `json:"timestamp"`                    // Время проведения работ (текстовое описание)
	Message   string    `json:"message" gorm:"type:text"`     // Описание работ
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}
