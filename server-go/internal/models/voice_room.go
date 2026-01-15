package models

import (
	"time"
)

type VoiceRoom struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ChatID    string    `gorm:"index;not null" json:"chatId"`
	CreatedBy string    `gorm:"not null" json:"createdBy"`
	IsActive  bool      `gorm:"default:true" json:"isActive"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (VoiceRoom) TableName() string {
	return "voice_rooms"
}

