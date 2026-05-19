package models

import (
	"time"
)

// DomainAllowBlock — чёрный/белый список доменов или email для инвайтов/регистрации
type DomainAllowBlock struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Value     string    `json:"value" gorm:"uniqueIndex:idx_domain_value;not null"` // domain.com или email@domain.com
	IsDomain  bool      `json:"isDomain" gorm:"default:true"`                       // true = домен, false = полный email
	Allow     bool      `json:"allow" gorm:"index"`                                 // true = whitelist, false = blacklist
	ForInvite bool      `json:"forInvite" gorm:"default:true"`
	ForReg    bool      `json:"forReg" gorm:"default:true"`
	CreatedBy string    `json:"createdBy" gorm:"index"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

func (DomainAllowBlock) TableName() string {
	return "domain_allow_block"
}
