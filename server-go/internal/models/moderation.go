package models

import (
	"time"

	"gorm.io/gorm"
)

// ChatModerationSettings настройки автомодерации для чата (группа/канал)
type ChatModerationSettings struct {
	ID                 string `gorm:"primaryKey" json:"id"`
	ChatID             string `gorm:"uniqueIndex;not null" json:"chatId"`
	Enabled            bool   `gorm:"default:false" json:"enabled"`
	BannedWords        string `gorm:"type:text" json:"bannedWords,omitempty"` // CSV/строка со словами
	MaxMsgsPer10s      int    `gorm:"default:8" json:"maxMsgsPer10s"`         // антиспам
	WarnThreshold      int    `gorm:"default:2" json:"warnThreshold"`         // после N предупреждений — бан
	BanMinutes         int    `gorm:"default:10" json:"banMinutes"`           // длительность временного бана
	QueueOnViolation   bool   `gorm:"default:false" json:"queueOnViolation"`  // отправлять в мод-очередь вместо автоделита
	UpdatedAt          time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (ChatModerationSettings) TableName() string {
	return "chat_moderation_settings"
}

// ChatWarning предупреждения в чате
type ChatWarning struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ChatID    string    `gorm:"index;not null" json:"chatId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	ActorID   string    `gorm:"index" json:"actorId,omitempty"`
	Reason    string    `gorm:"type:text" json:"reason,omitempty"`
	CreatedAt time.Time `gorm:"autoCreateTime;index" json:"createdAt"`
}

func (ChatWarning) TableName() string {
	return "chat_warnings"
}

// ChatBan временный бан в чате
type ChatBan struct {
	ID        string     `gorm:"primaryKey" json:"id"`
	ChatID    string     `gorm:"index;not null" json:"chatId"`
	UserID    string     `gorm:"index;not null" json:"userId"`
	ActorID   string     `gorm:"index" json:"actorId,omitempty"`
	Reason    string     `gorm:"type:text" json:"reason,omitempty"`
	ExpiresAt *time.Time `gorm:"index" json:"expiresAt,omitempty"`
	CreatedAt time.Time  `gorm:"autoCreateTime;index" json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ChatBan) TableName() string {
	return "chat_bans"
}

// ModerationLog лог действий модераторов
type ModerationLog struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ChatID    string    `gorm:"index" json:"chatId,omitempty"`
	ServerID  string    `gorm:"index" json:"serverId,omitempty"`
	ActorID   string    `gorm:"index" json:"actorId,omitempty"`
	Action    string    `gorm:"not null" json:"action"`
	TargetUserID    string `gorm:"index" json:"targetUserId,omitempty"`
	TargetMessageID string `gorm:"index" json:"targetMessageId,omitempty"`
	Metadata  string    `gorm:"type:text" json:"metadata,omitempty"`
	CreatedAt time.Time `gorm:"autoCreateTime;index" json:"createdAt"`
}

func (ModerationLog) TableName() string {
	return "moderation_logs"
}

