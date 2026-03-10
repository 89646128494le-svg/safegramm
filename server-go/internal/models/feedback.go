package models

import (
	"time"
)

// Feedback — заявки на премиум и обратная связь от пользователей
type Feedback struct {
	ID            string     `json:"id" gorm:"primaryKey"`
	UserID        string     `json:"userId" gorm:"index;not null"`
	Subject       string     `json:"subject" gorm:"type:text;not null"`
	Body          string     `json:"body" gorm:"type:text;not null"`
	Category      string     `json:"category" gorm:"default:general;index"`
	Priority      string     `json:"priority" gorm:"default:normal;index"`
	Status        string     `json:"status" gorm:"default:open;index"`
	ContactEmail  string     `json:"contactEmail"`
	ChatID        string     `json:"chatId" gorm:"index"`
	LastReplyAt   *time.Time `json:"lastReplyAt,omitempty"`
	LastMessageAt time.Time  `json:"lastMessageAt" gorm:"autoCreateTime"`
	ResolvedAt    *time.Time `json:"resolvedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt     time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (Feedback) TableName() string {
	return "feedbacks"
}
