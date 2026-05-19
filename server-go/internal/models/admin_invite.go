package models

import (
	"time"
)

// GlobalInviteLink — глобальная пригласительная ссылка (регистрация по инвайту, лимиты)
type GlobalInviteLink struct {
	ID            string     `json:"id" gorm:"primaryKey"`
	Code          string     `json:"code" gorm:"uniqueIndex;not null"`
	CreatedBy     string     `json:"createdBy" gorm:"index;not null"`
	InviterName   string     `json:"inviterName" gorm:"type:text"`   // "Вас пригласил ..."
	Questionnaire string     `json:"questionnaire" gorm:"type:text"` // JSON или текст анкеты для страницы приглашения
	MaxUses       int        `json:"maxUses" gorm:"default:0"`       // 0 = без лимита
	UsedCount     int        `json:"usedCount" gorm:"default:0"`
	ExpiresAt     *time.Time `json:"expiresAt"`
	Active        bool       `json:"active" gorm:"default:true"`
	CreatedAt     time.Time  `json:"createdAt" gorm:"autoCreateTime"`
}

func (GlobalInviteLink) TableName() string {
	return "global_invite_links"
}
