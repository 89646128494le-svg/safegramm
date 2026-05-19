package models

import "time"

// ServerRole — роль на сервере (как в Discord: имя, цвет, права).
type ServerRole struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	ServerID    string    `gorm:"index;not null" json:"serverId"`
	Name        string    `gorm:"not null" json:"name"`
	Color       string    `gorm:"size:7" json:"color,omitempty"` // hex без #
	Position    int       `gorm:"default:0" json:"position"`
	Permissions string    `gorm:"type:text" json:"-"` // JSON массив прав: ["manage_channels","kick_members",...]
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

// ServerMemberRole — связь участника сервера с ролью (много ролей у одного участника).
type ServerMemberRole struct {
	ServerID string `gorm:"primaryKey;index" json:"serverId"`
	UserID   string `gorm:"primaryKey;index" json:"userId"`
	RoleID   string `gorm:"primaryKey;index" json:"roleId"`
}

func (ServerRole) TableName() string       { return "server_roles" }
func (ServerMemberRole) TableName() string { return "server_member_roles" }
