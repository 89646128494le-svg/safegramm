package models

import (
	"encoding/json"
	"time"
)

// PollOption представляет вариант ответа в опросе
type PollOption struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

// Poll представляет опрос в сообщении
type Poll struct {
	ID         string       `gorm:"primaryKey" json:"id"`
	MessageID  string       `gorm:"uniqueIndex;not null" json:"messageId"`
	Question   string       `gorm:"not null" json:"question"`
	Options    string       `gorm:"type:text;not null" json:"-"` // JSON массив PollOption
	AllowsMulti bool        `gorm:"default:false" json:"allowsMulti"`
	CreatedAt  time.Time    `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Message Message     `gorm:"foreignKey:MessageID" json:"-"`
	Votes   []PollVote  `gorm:"foreignKey:PollID" json:"votes,omitempty"`
}

// GetOptions возвращает распарсенные опции опроса
func (p *Poll) GetOptions() ([]PollOption, error) {
	var options []PollOption
	if p.Options == "" {
		return options, nil
	}
	err := json.Unmarshal([]byte(p.Options), &options)
	return options, err
}

// SetOptions устанавливает опции опроса
func (p *Poll) SetOptions(options []PollOption) error {
	data, err := json.Marshal(options)
	if err != nil {
		return err
	}
	p.Options = string(data)
	return nil
}

// PollVote представляет голос пользователя в опросе
type PollVote struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	PollID    string    `gorm:"index;not null" json:"pollId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	OptionID  string    `gorm:"not null" json:"optionId"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Poll Poll `gorm:"foreignKey:PollID" json:"-"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Poll) TableName() string {
	return "polls"
}

func (PollVote) TableName() string {
	return "poll_votes"
}

