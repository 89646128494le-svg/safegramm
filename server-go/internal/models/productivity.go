package models

import (
	"time"

	"gorm.io/gorm"
)

type CalendarEvent struct {
	ID              string         `gorm:"primaryKey" json:"id"`
	Title           string         `gorm:"not null" json:"title"`
	Description     string         `gorm:"type:text" json:"description,omitempty"`
	StartTime       time.Time      `gorm:"index;not null" json:"startTime"`
	EndTime         *time.Time     `gorm:"index" json:"endTime,omitempty"`
	ChatID          string         `gorm:"index" json:"chatId,omitempty"`
	ReminderMinutes int            `gorm:"default:15" json:"reminderMinutes,omitempty"`
	CreatedBy       string         `gorm:"index;not null" json:"createdBy"`
	CreatedAt       time.Time      `gorm:"autoCreateTime;index" json:"createdAt"`
	UpdatedAt       time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type Todo struct {
	ID         string         `gorm:"primaryKey" json:"id"`
	Text       string         `gorm:"type:text;not null" json:"text"`
	Completed  bool           `gorm:"default:false;index" json:"completed"`
	ChatID     string         `gorm:"index" json:"chatId,omitempty"`
	AssignedTo string         `gorm:"index" json:"assignedTo,omitempty"`
	DueDate    *time.Time     `gorm:"index" json:"dueDate,omitempty"`
	Priority   string         `gorm:"default:medium" json:"priority,omitempty"`
	CreatedBy  string         `gorm:"index;not null" json:"createdBy"`
	CreatedAt  time.Time      `gorm:"autoCreateTime;index" json:"createdAt"`
	UpdatedAt  time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (CalendarEvent) TableName() string {
	return "calendar_events"
}

func (Todo) TableName() string {
	return "todos"
}
