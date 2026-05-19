package models

import (
	"time"

	"gorm.io/gorm"
)

// Payment хранит платёж (Stripe/YooKassa) для обновления плана пользователя
type Payment struct {
	ID         string         `gorm:"primaryKey" json:"id"`
	UserID     string         `gorm:"index;not null" json:"userId"`
	Provider   string         `gorm:"index;not null" json:"provider"` // stripe, yookassa
	ExternalID string         `gorm:"uniqueIndex;not null" json:"externalId"`
	Amount     int64          `gorm:"not null" json:"amount"` // в копейках/центах
	Currency   string         `gorm:"default:rub" json:"currency"`
	Plan       string         `gorm:"default:premium" json:"plan"`
	Status     string         `gorm:"index;not null" json:"status"` // pending, succeeded, failed, refunded
	Metadata   string         `gorm:"type:text" json:"metadata"`    // JSON
	CreatedAt  time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Payment) TableName() string { return "payments" }
