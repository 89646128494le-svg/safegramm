package models

import (
	"encoding/json"
	"strings"
)

// ParseRoles парсит JSON строку ролей в массив
func (u *User) ParseRoles() []string {
	if u.Roles == "" {
		return []string{}
	}
	var roles []string
	if err := json.Unmarshal([]byte(u.Roles), &roles); err != nil {
		// Если не JSON, пробуем как простую строку
		if u.Roles != "" {
			return []string{u.Roles}
		}
		return []string{}
	}
	return roles
}

// SetRoles устанавливает роли как JSON строку
func (u *User) SetRoles(roles []string) {
	if len(roles) == 0 {
		u.Roles = "[]"
		return
	}
	data, err := json.Marshal(roles)
	if err != nil {
		u.Roles = "[]"
		return
	}
	u.Roles = string(data)
}

// HasRole проверяет наличие роли
func (u *User) HasRole(role string) bool {
	roles := u.ParseRoles()
	for _, r := range roles {
		if strings.EqualFold(r, role) {
			return true
		}
	}
	return false
}

// ParseRecoveryCodes парсит JSON строку recovery codes
func (u *User) ParseRecoveryCodes() []string {
	if u.RecoveryCodes == "" {
		return []string{}
	}
	var codes []string
	if err := json.Unmarshal([]byte(u.RecoveryCodes), &codes); err != nil {
		return []string{}
	}
	return codes
}

// SetRecoveryCodes устанавливает recovery codes как JSON строку
func (u *User) SetRecoveryCodes(codes []string) {
	if len(codes) == 0 {
		u.RecoveryCodes = "[]"
		return
	}
	data, err := json.Marshal(codes)
	if err != nil {
		u.RecoveryCodes = "[]"
		return
	}
	u.RecoveryCodes = string(data)
}

