package models

import (
	"time"
	"gorm.io/gorm"
)

type Poll struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ChatID    string    `gorm:"index;not null" json:"chatId"`
	MessageID string    `gorm:"index;not null" json:"messageId"`
	Question  string    `gorm:"not null" json:"question"`
	CreatedBy string    `gorm:"not null" json:"createdBy"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Options []PollOption `gorm:"foreignKey:PollID" json:"options"`
	Votes   []PollVote  `gorm:"foreignKey:PollID" json:"votes,omitempty"`
}

type PollOption struct {
	ID     string `gorm:"primaryKey" json:"id"`
	PollID string `gorm:"index;not null" json:"pollId"`
	Text   string `gorm:"not null" json:"text"`
	Order  int    `json:"order"`
}

type PollVote struct {
	ID         string    `gorm:"primaryKey" json:"id"`
	PollID     string    `gorm:"index;not null" json:"pollId"`
	OptionID   string    `gorm:"index;not null" json:"optionId"`
	UserID     string    `gorm:"index;not null" json:"userId"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Poll   Poll `gorm:"foreignKey:PollID" json:"-"`
	Option PollOption `gorm:"foreignKey:OptionID" json:"option,omitempty"`
	User   User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Poll) TableName() string {
	return "polls"
}

func (PollOption) TableName() string {
	return "poll_options"
}

func (PollVote) TableName() string {
	return "poll_votes"
}
