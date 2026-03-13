package models

import "time"

// SystemBanner is a global user-facing announcement shown across the site.
type SystemBanner struct {
	ID          string     `json:"id" gorm:"primaryKey"`
	IsActive    bool       `json:"isActive" gorm:"default:false;index"`
	Title       string     `json:"title"`
	Message     string     `json:"message" gorm:"type:text"`
	Severity    string     `json:"severity" gorm:"default:info;index"`
	Dismissible bool       `json:"dismissible" gorm:"default:false"`
	StartsAt    *time.Time `json:"startsAt"`
	EndsAt      *time.Time `json:"endsAt"`
	CreatedAt   time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
}
