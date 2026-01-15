package models

import (
	"time"
)

type Server struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description,omitempty"`
	OwnerID     string    `gorm:"index;not null" json:"ownerId"`
	IconURL     string    `json:"iconUrl,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

type ServerMember struct {
	ID       string    `gorm:"primaryKey" json:"id"`
	ServerID string    `gorm:"index;not null" json:"serverId"`
	UserID   string    `gorm:"index;not null" json:"userId"`
	Role     string    `gorm:"default:member" json:"role"`
	JoinedAt time.Time `gorm:"autoCreateTime" json:"joinedAt"`

	// Relations
	User   User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Server Server `gorm:"foreignKey:ServerID" json:"-"`
}

type Channel struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ServerID  string    `gorm:"index;not null" json:"serverId"`
	Name      string    `gorm:"not null" json:"name"`
	Type      string    `gorm:"default:text" json:"type"`
	Position  int       `json:"position"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (Server) TableName() string {
	return "servers"
}

func (ServerMember) TableName() string {
	return "server_members"
}

func (Channel) TableName() string {
	return "channels"
}

