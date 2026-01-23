package models

import "time"

// ChannelCategory категория каналов внутри сервера (как в Discord)
type ChannelCategory struct {
	ID       string    `gorm:"primaryKey" json:"id"`
	ServerID string    `gorm:"index;not null" json:"serverId"`
	Name     string    `gorm:"not null" json:"name"`
	Position int       `json:"position"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (ChannelCategory) TableName() string {
	return "channel_categories"
}

