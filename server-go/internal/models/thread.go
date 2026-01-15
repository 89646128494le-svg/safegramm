package models

import (
	"time"
)

type Thread struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	ChatID       string    `gorm:"index;not null" json:"chatId"`
	RootMessageID string   `gorm:"index;not null" json:"rootMessageId"`
	Name         string    `json:"name,omitempty"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (Thread) TableName() string {
	return "threads"
}

