package models

import "time"

// MemberEvent история участников для групп/серверов
// ScopeType: "chat" или "server"
// Action: "join" | "leave" | "add" | "remove" | "role_change" | "ban" | "unban" | "warn"
type MemberEvent struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ScopeType string    `gorm:"index;not null" json:"scopeType"`
	ScopeID   string    `gorm:"index;not null" json:"scopeId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	ActorID   string    `gorm:"index" json:"actorId,omitempty"` // кто совершил действие (может быть пустым для self-join)
	Action    string    `gorm:"not null" json:"action"`
	Details   string    `gorm:"type:text" json:"details,omitempty"` // произвольные детали (JSON строка)
	CreatedAt time.Time `gorm:"autoCreateTime;index" json:"createdAt"`
}

func (MemberEvent) TableName() string {
	return "member_events"
}

