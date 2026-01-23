package models

import "time"

// Webhook интеграция (вебхук) для чата/сервера
// ScopeType: "chat" | "server"
type Webhook struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ScopeType string    `gorm:"index;not null" json:"scopeType"`
	ScopeID   string    `gorm:"index;not null" json:"scopeId"`
	URL       string    `gorm:"type:text;not null" json:"url"`
	Events    string    `gorm:"type:text" json:"events,omitempty"` // CSV, например: "message.created,member.join"
	Secret    string    `gorm:"type:text" json:"secret,omitempty"`
	CreatedAt time.Time `gorm:"autoCreateTime;index" json:"createdAt"`
}

func (Webhook) TableName() string {
	return "webhooks"
}

