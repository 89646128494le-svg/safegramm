package api

import (
	"strings"
	"sync"
	"time"
)

// EmailCodeData структура для хранения кода
type EmailCodeData struct {
	Code      string
	ExpiresAt time.Time
}

// EmailCodeStorage хранилище кодов (в production использовать Redis)
var emailCodeStorage = make(map[string]EmailCodeData)
var emailCodeMutex sync.RWMutex

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// StoreEmailCode сохраняет код для email (email и code нормализуются)
func StoreEmailCode(email, code string, expiresIn time.Duration) {
	emailCodeMutex.Lock()
	defer emailCodeMutex.Unlock()
	key := normalizeEmail(email)
	emailCodeStorage[key] = EmailCodeData{
		Code:      strings.TrimSpace(code),
		ExpiresAt: time.Now().Add(expiresIn),
	}
}

// VerifyEmailCode проверяет код для email (email и code нормализуются)
func VerifyEmailCode(email, code string) (bool, error) {
	key := normalizeEmail(email)
	code = strings.TrimSpace(code)
	emailCodeMutex.RLock()
	stored, exists := emailCodeStorage[key]
	if !exists {
		emailCodeMutex.RUnlock()
		return false, nil
	}
	expired := time.Now().After(stored.ExpiresAt)
	storedCode := stored.Code
	emailCodeMutex.RUnlock()
	if expired {
		emailCodeMutex.Lock()
		delete(emailCodeStorage, key)
		emailCodeMutex.Unlock()
		return false, nil
	}
	if storedCode != code {
		return false, nil
	}
	emailCodeMutex.Lock()
	delete(emailCodeStorage, key)
	emailCodeMutex.Unlock()
	return true, nil
}

// DeleteEmailCode удаляет код (для очистки)
func DeleteEmailCode(email string) {
	emailCodeMutex.Lock()
	defer emailCodeMutex.Unlock()
	delete(emailCodeStorage, normalizeEmail(email))
}

// ——— Коды восстановления пароля (отдельное хранилище) ———

var resetCodeStorage = make(map[string]EmailCodeData)
var resetCodeMutex sync.RWMutex

// StorePasswordResetCode сохраняет код сброса пароля (15 мин)
func StorePasswordResetCode(email, code string, expiresIn time.Duration) {
	resetCodeMutex.Lock()
	defer resetCodeMutex.Unlock()
	key := normalizeEmail(email)
	resetCodeStorage[key] = EmailCodeData{
		Code:      strings.TrimSpace(code),
		ExpiresAt: time.Now().Add(expiresIn),
	}
}

// VerifyAndConsumePasswordResetCode проверяет код и удаляет его при успехе
func VerifyAndConsumePasswordResetCode(email, code string) bool {
	key := normalizeEmail(email)
	code = strings.TrimSpace(code)
	resetCodeMutex.Lock()
	defer resetCodeMutex.Unlock()
	stored, exists := resetCodeStorage[key]
	if !exists || stored.Code != code || time.Now().After(stored.ExpiresAt) {
		return false
	}
	delete(resetCodeStorage, key)
	return true
}
