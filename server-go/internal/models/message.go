package models

import (
	"time"
)

type Message struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	ChatID      string    `gorm:"index;not null" json:"chatId"`
	SenderID    string    `gorm:"index;not null" json:"senderId"`
	Text         string    `json:"text,omitempty"`
	Ciphertext   string    `gorm:"type:text" json:"ciphertext,omitempty"` // Зашифрованное сообщение (для E2EE групп)
	ModerationStatus string `gorm:"index;default:approved" json:"moderationStatus,omitempty"` // approved | pending | rejected
	ModerationReason string `gorm:"type:text" json:"moderationReason,omitempty"`
	AttachmentURL string   `json:"attachmentUrl,omitempty"`
	ReplyTo     string    `gorm:"index" json:"replyTo,omitempty"`
	ForwardFrom string    `json:"forwardFrom,omitempty"`
	ThreadID    string    `gorm:"index" json:"threadId,omitempty"`
	StickerID   string    `json:"stickerId,omitempty"`
	GifURL      string    `json:"gifUrl,omitempty"`
	LocationLat *float64  `json:"locationLat,omitempty"`
	LocationLon *float64  `json:"locationLon,omitempty"`
	EditedAt    *time.Time `json:"editedAt,omitempty"`
	DeletedAt   *time.Time `gorm:"index" json:"deletedAt,omitempty"`
	ExpiresAt   *time.Time `json:"expiresAt,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime;index" json:"createdAt"`
	
	// Новые типы сообщений
	PollID      string    `gorm:"index" json:"pollId,omitempty"` // ID опроса
	CalendarEventJSON string `gorm:"type:text" json:"-"` // JSON календарного события
	ContactJSON string    `gorm:"type:text" json:"-"` // JSON контакта
	DocumentJSON string   `gorm:"type:text" json:"-"` // JSON документа
	EditHistoryJSON string `gorm:"type:text" json:"-"` // JSON истории редактирования

	// Relations
	Sender User `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
	Chat   Chat `gorm:"foreignKey:ChatID" json:"chat,omitempty"`
	Reactions []MessageReaction `gorm:"foreignKey:MessageID" json:"reactions,omitempty"`
	Poll   *Poll `gorm:"foreignKey:ID;references:PollID" json:"poll,omitempty"`
}

type MessageReaction struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	MessageID string    `gorm:"index;not null" json:"messageId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	Emoji     string    `gorm:"not null" json:"emoji"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Message Message `gorm:"foreignKey:MessageID" json:"-"`
	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Message) TableName() string {
	return "messages"
}

func (MessageReaction) TableName() string {
	return "message_reactions"
}

