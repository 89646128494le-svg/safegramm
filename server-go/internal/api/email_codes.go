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
	stored, exists := emailCodeStorage[email]
	if !exists {
		emailCodeMutex.RUnlock()
		return false, nil
	}
	
	// Проверяем срок действия
	expired := time.Now().After(stored.ExpiresAt)
	storedCode := stored.Code
	emailCodeMutex.RUnlock()
	
	if expired {
		// Удаляем истекший код
		emailCodeMutex.Lock()
		delete(emailCodeStorage, email)
		emailCodeMutex.Unlock()
		return false, nil
	}
	
	if storedCode != code {
		return false, nil
	}
	
	// Код верный, удаляем его
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
