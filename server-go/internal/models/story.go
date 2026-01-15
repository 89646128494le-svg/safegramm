package models

import "time"

// Story представляет историю/статус пользователя
type Story struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	UserID      string    `gorm:"index;not null" json:"userId"`
	Type        string    `gorm:"not null" json:"type"` // image, video, text
	ContentURL  string    `json:"contentUrl,omitempty"` // URL изображения/видео
	Text        string    `json:"text,omitempty"`       // Текст для текстовых историй
	BackgroundColor string `json:"backgroundColor,omitempty"` // Цвет фона для текстовых историй
	ExpiresAt   time.Time `gorm:"index;not null" json:"expiresAt"` // Время истечения (обычно 24 часа)
	CreatedAt   time.Time `gorm:"autoCreateTime;index" json:"createdAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Views []StoryView `gorm:"foreignKey:StoryID" json:"views,omitempty"`
}

// StoryView представляет просмотр истории пользователем
type StoryView struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	StoryID   string    `gorm:"index;not null" json:"storyId"`
	UserID    string    `gorm:"index;not null" json:"userId"`
	ViewedAt  time.Time `gorm:"autoCreateTime" json:"viewedAt"`

	// Relations
	Story Story `gorm:"foreignKey:StoryID" json:"-"`
	User  User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Story) TableName() string {
	return "stories"
}

func (StoryView) TableName() string {
	return "story_views"
}

