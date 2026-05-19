package models

import (
	"time"
)

// EmailTemplate — шаблон рассылки (приглашения, уведомления, техработы)
type EmailTemplate struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"index;not null"`
	Type      string    `json:"type" gorm:"index;not null"` // invite, notification, maintenance
	Subject   string    `json:"subject" gorm:"type:text"`
	BodyHTML  string    `json:"bodyHtml" gorm:"type:text"`
	BodyText  string    `json:"bodyText" gorm:"type:text"`
	Variables string    `json:"variables" gorm:"type:text"` // JSON список переменных {{name}}, {{link}}
	Active    bool      `json:"active" gorm:"default:true"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (EmailTemplate) TableName() string {
	return "email_templates"
}

// ScheduledBroadcast — запланированная рассылка
type ScheduledBroadcast struct {
	ID          string     `json:"id" gorm:"primaryKey"`
	TemplateID  string     `json:"templateId" gorm:"index"`
	Subject     string     `json:"subject" gorm:"type:text"`
	BodyHTML    string     `json:"bodyHtml" gorm:"type:text"`
	FilterPlan  string     `json:"filterPlan"` // "", "free", "premium"
	FilterRole  string     `json:"filterRole"`
	ScheduledAt time.Time  `json:"scheduledAt" gorm:"index"`
	SentAt      *time.Time `json:"sentAt"`
	CreatedBy   string     `json:"createdBy" gorm:"index"`
	CreatedAt   time.Time  `json:"createdAt" gorm:"autoCreateTime"`
}

func (ScheduledBroadcast) TableName() string {
	return "scheduled_broadcasts"
}
