package models

import (
	"time"

	"gorm.io/gorm"
)

// GroupKey хранит зашифрованный групповой ключ для каждого участника
type GroupKey struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ChatID    string    `gorm:"index;not null" json:"chatId"`
	UserID    string    `gorm:"index;not null" json:"userId"` // Для кого зашифрован ключ
	WrappedKey string   `gorm:"type:text;not null" json:"wrappedKey"` // Зашифрованный групповой ключ
	KeyVersion int      `gorm:"default:1" json:"keyVersion"` // Версия ключа (увеличивается при обновлении)
	CreatedBy  string    `gorm:"not null" json:"createdBy"` // Кто создал/обновил ключ
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"createdAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Chat Chat `gorm:"foreignKey:ChatID" json:"-"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (GroupKey) TableName() string {
	return "group_keys"
}
