package models

import (
	"time"
)

// BannedWord — запрещённая фраза/слово с авто-действием
type BannedWord struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Phrase    string    `json:"phrase" gorm:"index;not null"`   // фраза или regex
	IsRegex   bool      `json:"isRegex" gorm:"default:false"`
	Action    string    `json:"action" gorm:"index;not null"`   // warn, ban, delete_message
	Scope     string    `json:"scope" gorm:"default:global"`    // global, group, channel
	Active    bool      `json:"active" gorm:"default:true"`
	CreatedBy string    `json:"createdBy" gorm:"index"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (BannedWord) TableName() string {
	return "banned_words"
}
