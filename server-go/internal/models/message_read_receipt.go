package models

import (
	"time"
)

// MessageReadReceipt отслеживает статус прочтения сообщения пользователем
type MessageReadReceipt struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	MessageID string    `gorm:"index;not null" json:"messageId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	ReadAt    time.Time `gorm:"autoCreateTime;index" json:"readAt"`

	// Relations
	Message Message `gorm:"foreignKey:MessageID" json:"-"`
	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (MessageReadReceipt) TableName() string {
	return "message_read_receipts"
}


