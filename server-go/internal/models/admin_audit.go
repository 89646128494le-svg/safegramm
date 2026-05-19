package models

import (
	"time"
)

// AdminAuditLog — лог действий админов (кто кого забанил, выдал роль и т.д.)
type AdminAuditLog struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	AdminID   string    `json:"adminId" gorm:"index;not null"`
	TargetID  string    `json:"targetId" gorm:"index"`        // user/chat/message id
	Action    string    `json:"action" gorm:"index;not null"` // block_user, unblock_user, promote, demote, delete_user, ban_chat, etc.
	Details   string    `json:"details" gorm:"type:text"`     // JSON или текст
	IP        string    `json:"ip,omitempty" gorm:"type:varchar(64)"`
	UserAgent string    `json:"userAgent,omitempty" gorm:"type:text"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;index"`
}

func (AdminAuditLog) TableName() string {
	return "admin_audit_logs"
}

// RoleBanHistory — история смены ролей и банов по пользователю
type RoleBanHistory struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index;not null"`
	AdminID   string    `json:"adminId" gorm:"index;not null"`
	Action    string    `json:"action" gorm:"index;not null"` // role_add, role_remove, ban, unban
	OldValue  string    `json:"oldValue" gorm:"type:text"`    // предыдущие роли или статус
	NewValue  string    `json:"newValue" gorm:"type:text"`
	Reason    string    `json:"reason" gorm:"type:text"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;index"`
}

func (RoleBanHistory) TableName() string {
	return "role_ban_history"
}
