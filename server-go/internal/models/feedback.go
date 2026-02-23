package models

import (
	"time"
)

// Feedback — заявки на премиум и обратная связь от пользователей
type Feedback struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index;not null"`
	Subject   string    `json:"subject" gorm:"type:text;not null"`
	Body      string    `json:"body" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

func (Feedback) TableName() string {
	return "feedbacks"
}
