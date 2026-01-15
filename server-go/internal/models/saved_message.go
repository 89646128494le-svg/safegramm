package models

import "time"

// SavedMessage представляет сохраненное сообщение пользователя
type SavedMessage struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	MessageID string    `gorm:"index;not null" json:"messageId"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	User    User    `gorm:"foreignKey:UserID" json:"-"`
	Message Message `gorm:"foreignKey:MessageID" json:"message,omitempty"`
}

func (SavedMessage) TableName() string {
	return "saved_messages"
}

