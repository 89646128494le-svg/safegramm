package models

import (
	"time"

	"gorm.io/gorm"
)

type Chat struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Type        string    `gorm:"not null" json:"type"` // dm, group, channel
	Name        string    `json:"name,omitempty"`
	Description string    `json:"description,omitempty"`
	AvatarURL   string    `json:"avatarUrl,omitempty"`
	CreatedBy   string    `json:"createdBy,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Members []ChatMember `gorm:"foreignKey:ChatID" json:"members,omitempty"`
	Messages []Message   `gorm:"foreignKey:ChatID" json:"messages,omitempty"`
}

type ChatMember struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ChatID    string    `gorm:"index;not null" json:"chatId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	Role      string    `gorm:"default:member" json:"role"` // owner, admin, member
	JoinedAt  time.Time `gorm:"autoCreateTime" json:"joinedAt"`
	ArchivedAt *time.Time `gorm:"index" json:"archivedAt,omitempty"` // Когда пользователь заархивировал чат
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Chat Chat `gorm:"foreignKey:ChatID" json:"chat,omitempty"`
}

func (Chat) TableName() string {
	return "chats"
}

func (ChatMember) TableName() string {
	return "chat_members"
}

