package models

import (
	"time"
)

// UserBot — бот пользователя (BotFather-style): создаётся пользователем, хранится токен для API
type UserBot struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"index;not null"`
	Username    string    `json:"username" gorm:"uniqueIndex:idx_user_bots_username;not null"` // уникальный в системе, без @
	Name        string    `json:"name" gorm:"not null"`
	Description string    `json:"description" gorm:"type:text"`
	Token       string    `json:"-" gorm:"not null"` // не отдаём в списке/детали; только при create/revoke
	WebhookURL  string    `json:"webhookUrl,omitempty" gorm:"column:webhook_url;type:text"` // URL для входящих сообщений боту
	IsActive    bool      `json:"isActive" gorm:"default:true"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (UserBot) TableName() string {
	return "user_bots"
}
