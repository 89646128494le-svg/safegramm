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
	ShowBio       bool      `gorm:"default:true" json:"showBio"`
	ShowAvatar    bool      `gorm:"default:true" json:"showAvatar"`
	LastSeen      *time.Time `json:"lastSeen,omitempty"`
	TwoFASecret   string    `json:"-"`
	RecoveryCodes string    `gorm:"type:text" json:"-"` // JSON массив как строка
	PinHash       string    `json:"-"`
	PinSalt       string    `json:"-"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (User) TableName() string {
	return "users"
}

