package models

import (
	"time"
)

type Call struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	ChatID      string     `gorm:"index;not null" json:"chatId"`
	CallerID    string     `gorm:"index;not null" json:"callerId"`
	ReceiverID  string     `gorm:"index;not null" json:"receiverId"`
	Type        string     `gorm:"not null" json:"type"` // "voice" | "video"
	Status      string     `gorm:"index;not null" json:"status"` // "completed" | "missed" | "declined" | "cancelled"
	Duration    int        `json:"duration"` // в секундах
	StartedAt   time.Time  `gorm:"index" json:"startedAt"`
	AnsweredAt  *time.Time `json:"answeredAt,omitempty"`
	EndedAt     *time.Time `json:"endedAt,omitempty"`
	RecordingURL string    `json:"recordingUrl,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Caller   User `gorm:"foreignKey:CallerID" json:"caller,omitempty"`
	Receiver User `gorm:"foreignKey:ReceiverID" json:"receiver,omitempty"`
	Chat     Chat `gorm:"foreignKey:ChatID" json:"chat,omitempty"`
}

type GroupCall struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	ChatID      string     `gorm:"index;not null" json:"chatId"`
	StartedBy   string     `gorm:"index;not null" json:"startedBy"`
	Type        string     `gorm:"not null" json:"type"` // "voice" | "video"
	Status      string     `gorm:"index;not null" json:"status"` // "active" | "ended"
	StartedAt   time.Time  `gorm:"index" json:"startedAt"`
	EndedAt     *time.Time `json:"endedAt,omitempty"`
	RecordingURL string    `json:"recordingUrl,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Starter User `gorm:"foreignKey:StartedBy" json:"starter,omitempty"`
	Chat    Chat `gorm:"foreignKey:ChatID" json:"chat,omitempty"`
	Participants []GroupCallParticipant `gorm:"foreignKey:CallID" json:"participants,omitempty"`
}

type GroupCallParticipant struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	CallID    string    `gorm:"index;not null" json:"callId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	JoinedAt  time.Time `gorm:"autoCreateTime" json:"joinedAt"`
	LeftAt    *time.Time `json:"leftAt,omitempty"`
	Duration  int       `json:"duration"` // в секундах

	// Relations
	Call GroupCall `gorm:"foreignKey:CallID" json:"-"`
	User User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Call) TableName() string {
	return "calls"
}

func (GroupCall) TableName() string {
	return "group_calls"
}

func (GroupCallParticipant) TableName() string {
	return "group_call_participants"
}
