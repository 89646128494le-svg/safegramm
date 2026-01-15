package models

import (
	"time"
)

type StickerPack struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Title       string    `json:"title"`
	ThumbnailURL string   `json:"thumbnailUrl,omitempty"`
	IsAnimated  bool      `json:"isAnimated"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
	Stickers    []Sticker `gorm:"foreignKey:PackID" json:"stickers,omitempty"`
}

type Sticker struct {
	ID       string    `gorm:"primaryKey" json:"id"`
	PackID   string    `gorm:"index;not null" json:"packId"`
	Emoji    string    `json:"emoji"`
	URL      string    `gorm:"not null" json:"url"`
	Width    int       `json:"width"`
	Height   int       `json:"height"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	Pack     StickerPack `gorm:"foreignKey:PackID" json:"-"`
}

func (StickerPack) TableName() string {
	return "sticker_packs"
}

func (Sticker) TableName() string {
	return "stickers"
}

