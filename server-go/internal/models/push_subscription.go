package models

import "time"

// PushSubscription представляет подписку на push-уведомления
type PushSubscription struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	Endpoint  string    `gorm:"not null" json:"endpoint"`
	P256dh    string    `gorm:"not null" json:"p256dh"`
	Auth      string    `gorm:"not null" json:"auth"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"-"`
}

func (PushSubscription) TableName() string {
	return "push_subscriptions"
}


