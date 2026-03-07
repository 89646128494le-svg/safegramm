package models

import (
	"time"

	"gorm.io/gorm"
)

// AdminBan — глобальный бан (для админки). Используется совместно со статусом пользователя.
// Active бан = revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now)
type AdminBan struct {
	ID        string         `gorm:"primaryKey" json:"id"`
	UserID    string         `gorm:"index;not null" json:"userId"`
	Username  string         `gorm:"index" json:"username,omitempty"`
	Reason    string         `gorm:"type:text" json:"reason,omitempty"`
	AdminID   string         `gorm:"index" json:"adminId,omitempty"`
	ExpiresAt *time.Time     `gorm:"index" json:"expiresAt,omitempty"`
	RevokedAt *time.Time     `gorm:"index" json:"revokedAt,omitempty"`
	CreatedAt time.Time      `gorm:"autoCreateTime;index" json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AdminBan) TableName() string {
	return "admin_bans"
}

// AdminMute — мут в конкретном чате/канале (для админки).
// Active мут = revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now)
type AdminMute struct {
	ID        string         `gorm:"primaryKey" json:"id"`
	UserID    string         `gorm:"index;not null" json:"userId"`
	Username  string         `gorm:"index" json:"username,omitempty"`
	ChatID    string         `gorm:"index;not null" json:"chatId"`
	ChatName  string         `gorm:"index" json:"chatName,omitempty"`
	Reason    string         `gorm:"type:text" json:"reason,omitempty"`
	AdminID   string         `gorm:"index" json:"adminId,omitempty"`
	ExpiresAt *time.Time     `gorm:"index" json:"expiresAt,omitempty"`
	RevokedAt *time.Time     `gorm:"index" json:"revokedAt,omitempty"`
	CreatedAt time.Time      `gorm:"autoCreateTime;index" json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AdminMute) TableName() string {
	return "admin_mutes"
}

