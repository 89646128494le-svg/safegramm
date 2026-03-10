package models

import (
	"time"

	"gorm.io/gorm"
)

// Subscription stores the current lifecycle of a paid premium plan.
type Subscription struct {
	ID                 string         `gorm:"primaryKey" json:"id"`
	UserID             string         `gorm:"index;not null" json:"userId"`
	PlanID             string         `gorm:"index;not null" json:"planId"`
	Plan               string         `gorm:"default:premium" json:"plan"`
	Provider           string         `gorm:"index;not null" json:"provider"`
	ExternalID         string         `gorm:"index" json:"externalId"`
	Status             string         `gorm:"index;not null" json:"status"` // pending, active, canceled, expired
	BillingCycle       string         `gorm:"size:20" json:"billingCycle"`
	Amount             int64          `gorm:"not null" json:"amount"`
	Currency           string         `gorm:"default:rub" json:"currency"`
	CurrentPeriodStart *time.Time     `json:"currentPeriodStart,omitempty"`
	CurrentPeriodEnd   *time.Time     `gorm:"index" json:"currentPeriodEnd,omitempty"`
	CancelAtPeriodEnd  bool           `gorm:"default:false" json:"cancelAtPeriodEnd"`
	CanceledAt         *time.Time     `json:"canceledAt,omitempty"`
	Metadata           string         `gorm:"type:text" json:"metadata"`
	CreatedAt          time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Subscription) TableName() string { return "subscriptions" }
