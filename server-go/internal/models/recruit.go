package models

import (
	"time"
)

// RecruitApplication — заявка в тестировщики или хелперы
type RecruitApplication struct {
	ID         string     `json:"id" gorm:"primaryKey"`
	Email      string     `json:"email" gorm:"index;not null"`
	Name       string     `json:"name" gorm:"type:text"`
	Role       string     `json:"role" gorm:"index;not null"` // tester | helper
	Message    string     `json:"message" gorm:"type:text"`
	Status     string     `json:"status" gorm:"index;default:pending"` // pending | approved | declined
	DeclineReason string  `json:"declineReason" gorm:"type:text"`
	CreatedAt  time.Time  `json:"createdAt" gorm:"autoCreateTime"`
}

func (RecruitApplication) TableName() string {
	return "recruit_applications"
}
