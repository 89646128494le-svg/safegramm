package models

import (
	"time"
)

// PinnedMessage представляет закрепленное сообщение в чате
type PinnedMessage struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ChatID    string    `gorm:"index;not null" json:"chatId"`
	MessageID string    `gorm:"index;not null;uniqueIndex:idx_chat_message" json:"messageId"`
	PinnedBy  string    `gorm:"index;not null" json:"pinnedBy"` // ID пользователя, который закрепил
	PinnedAt  time.Time `gorm:"autoCreateTime;index" json:"pinnedAt"`

	// Relations
	Chat    Chat    `gorm:"foreignKey:ChatID" json:"-"`
	Message Message `gorm:"foreignKey:MessageID" json:"message,omitempty"`
	User    User    `gorm:"foreignKey:PinnedBy" json:"user,omitempty"`
}

func (PinnedMessage) TableName() string {
	return "pinned_messages"
}


