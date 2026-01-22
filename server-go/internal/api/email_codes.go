package api

import (
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

// StoreEmailCode сохраняет код для email
func StoreEmailCode(email, code string, expiresIn time.Duration) {
	emailCodeMutex.Lock()
	defer emailCodeMutex.Unlock()
	emailCodeStorage[email] = EmailCodeData{
		Code:      code,
		ExpiresAt: time.Now().Add(expiresIn),
	}
}

// VerifyEmailCode проверяет код для email
func VerifyEmailCode(email, code string) (bool, error) {
	emailCodeMutex.RLock()
	defer emailCodeMutex.RUnlock()
	
	stored, exists := emailCodeStorage[email]
	if !exists {
		return false, nil
	}
	
	if time.Now().After(stored.ExpiresAt) {
		// Удаляем истекший код
		emailCodeMutex.RUnlock()
		emailCodeMutex.Lock()
		delete(emailCodeStorage, email)
		emailCodeMutex.Unlock()
		emailCodeMutex.RLock()
		return false, nil
	}
	
	if stored.Code != code {
		return false, nil
	}
	
	// Код верный, удаляем его
	emailCodeMutex.RUnlock()
	emailCodeMutex.Lock()
	delete(emailCodeStorage, email)
	emailCodeMutex.Unlock()
	
	return true, nil
}

// DeleteEmailCode удаляет код (для очистки)
func DeleteEmailCode(email string) {
	emailCodeMutex.Lock()
	defer emailCodeMutex.Unlock()
	delete(emailCodeStorage, email)
}
