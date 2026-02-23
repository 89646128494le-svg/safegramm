package models

import (
	"time"
)

// SafetyAlert — алерт по срабатыванию Safety AI (антискам, deepfake и т.п.)
type SafetyAlert struct {
	ID        string     `json:"id" gorm:"primaryKey"`
	Type      string     `json:"type" gorm:"index;not null"`   // antiscam, deepfake, filter, etc.
	UserID    string     `json:"userId" gorm:"index"`
	ChatID    string     `json:"chatId" gorm:"index"`
	MessageID string     `json:"messageId" gorm:"index"`
	Payload   string     `json:"payload" gorm:"type:text"`     // JSON
	Resolved  bool       `json:"resolved" gorm:"default:false"`
	ResolvedBy string    `json:"resolvedBy" gorm:"index"`
	ResolvedAt *time.Time `json:"resolvedAt"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime;index"`
}

func (SafetyAlert) TableName() string {
	return "safety_alerts"
}

// SuspiciousActivity — лог подозрительных действий (смена пароля, 2FA, вход с нового IP)
type SuspiciousActivity struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index;not null"`
	Action    string    `json:"action" gorm:"index;not null"` // password_change, 2fa_enable, 2fa_disable, new_login, recovery_used
	IP        string    `json:"ip" gorm:"type:varchar(64)"`
	UserAgent string    `json:"userAgent" gorm:"type:text"`
	Details   string    `json:"details" gorm:"type:text"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;index"`
}

func (SuspiciousActivity) TableName() string {
	return "suspicious_activities"
}
