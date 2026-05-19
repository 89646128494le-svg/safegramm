package models

import (
	"time"
)

// SystemLimit — настройки лимитов (размер файла, участники группы, API)
type SystemLimit struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Key       string    `json:"key" gorm:"uniqueIndex;not null"` // file_size_mb, group_members_max, api_requests_per_min, bots_per_user
	Value     string    `json:"value" gorm:"not null"`           // число или JSON
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (SystemLimit) TableName() string {
	return "system_limits"
}

// FeatureFlag — A/B или feature flag по ролям/планам
type FeatureFlag struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Key       string    `json:"key" gorm:"uniqueIndex;not null"`
	Enabled   bool      `json:"enabled" gorm:"default:true"`
	Roles     string    `json:"roles" gorm:"type:text"`     // JSON массив ролей, пусто = все
	Plans     string    `json:"plans" gorm:"type:text"`     // JSON массив планов
	Percent   int       `json:"percent" gorm:"default:100"` // 0-100 для A/B
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (FeatureFlag) TableName() string {
	return "feature_flags"
}

// SecurityPolicy — политика паролей и 2FA (глобальные настройки)
type SecurityPolicy struct {
	ID                     string    `json:"id" gorm:"primaryKey"`
	Require2FAForAdmins    bool      `json:"require2FAForAdmins" gorm:"default:false"`
	SessionMaxDays         int       `json:"sessionMaxDays" gorm:"default:30"`
	PasswordMinLength      int       `json:"passwordMinLength" gorm:"default:8"`
	PasswordRequireSpecial bool      `json:"passwordRequireSpecial" gorm:"default:false"`
	UpdatedAt              time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (SecurityPolicy) TableName() string {
	return "security_policies"
}
