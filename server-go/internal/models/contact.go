package models

import (
	"time"

	"github.com/google/uuid"
)

// Contact — контакт пользователя (список «друзей»).
type Contact struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"uniqueIndex:idx_contact_pair;not null" json:"userId"`
	ContactID string    `gorm:"uniqueIndex:idx_contact_pair;not null" json:"contactId"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (Contact) TableName() string {
	return "contacts"
}

func NewContact(userID, contactID string) Contact {
	return Contact{
		ID:        uuid.New().String(),
		UserID:    userID,
		ContactID: contactID,
	}
}
