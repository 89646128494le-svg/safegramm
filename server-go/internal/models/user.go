package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	Username      string    `gorm:"uniqueIndex;not null" json:"username"`
	Email         *string   `gorm:"uniqueIndex" json:"email,omitempty"`
	PassHash      string    `gorm:"not null" json:"-"`
	Salt          string    `gorm:"not null" json:"-"`
	Roles         string    `gorm:"type:text" json:"roles"` // JSON массив как строка
	Plan          string    `gorm:"default:free" json:"plan"`
	AvatarURL     string    `json:"avatarUrl,omitempty"`
	About         string    `json:"about,omitempty"`
	Status        string    `gorm:"default:online" json:"status"`
	ProfileColor  string    `gorm:"default:#3b82f6" json:"profileColor"`
	ShowBio             bool       `gorm:"default:true" json:"showBio"`
	ShowAvatar          bool       `gorm:"default:true" json:"showAvatar"`
	AllowFindByUsername bool       `gorm:"default:true" json:"allowFindByUsername"` // по умолчанию показывать в поиске; в настройках можно отключить
	LastSeenVisibility  string     `gorm:"default:nobody;size:20" json:"lastSeenVisibility"` // nobody | contacts | everyone
	LastSeen            *time.Time `json:"lastSeen,omitempty"`
	TwoFASecret   string    `json:"-"`
	RecoveryCodes string    `gorm:"type:text" json:"-"` // JSON массив как строка
	PinHash       string    `json:"-"`
	PinSalt       string    `json:"-"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	// Приватный ключ и сид-фраза никогда не записываются в БД (только в RAM из mnemonic при необходимости).
}

func (User) TableName() string {
	return "users"
}

