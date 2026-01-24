package models

import (
	"time"
)

type Session struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	Token     string    `gorm:"uniqueIndex;not null" json:"-"`
	IPAddress string    `json:"ipAddress,omitempty"`
	UserAgent string    `json:"userAgent,omitempty"`
	Device    string    `json:"device,omitempty"` // "desktop", "mobile", "tablet", "web"
	Location  string    `json:"location,omitempty"`
	IsActive  bool      `gorm:"default:true" json:"isActive"`
	LastUsed  time.Time `gorm:"index" json:"lastUsed"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	ExpiresAt time.Time `gorm:"index" json:"expiresAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Session) TableName() string {
	return "sessions"
}
