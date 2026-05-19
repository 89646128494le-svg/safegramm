package models

import (
	"time"
)

// MaintenanceMode model
type MaintenanceMode struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	IsActive  bool      `json:"isActive" gorm:"default:false;index"`
	Timestamp string    `json:"timestamp"`
	Message   string    `json:"message" gorm:"type:text"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}
