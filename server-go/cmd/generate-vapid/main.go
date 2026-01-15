package main

import (
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// Генерирует VAPID ключи для web push уведомлений
// VAPID использует эллиптическую кривую P-256
func main() {
	// Генерируем приватный ключ
	privateKey, x, y, err := elliptic.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}

	// Публичный ключ для VAPID - это uncompressed точка (0x04 + x + y)
	// Формат: 0x04 (1 байт) + x (32 байта) + y (32 байта) = 65 байт
	publicKeyBytes := elliptic.Marshal(elliptic.P256(), x, y)

	// Кодируем в base64 URL-safe формат (без padding)
	// Приватный ключ - это просто 32 байта
	privateKeyBase64 := base64.RawURLEncoding.EncodeToString(privateKey)
	// Публичный ключ - это 65 байт (uncompressed точка)
	publicKeyBase64 := base64.RawURLEncoding.EncodeToString(publicKeyBytes)

	fmt.Println("VAPID ключи сгенерированы:")
	fmt.Println("")
	fmt.Println("VAPID_PUBLIC_KEY=" + publicKeyBase64)
	fmt.Println("VAPID_PRIVATE_KEY=" + privateKeyBase64)
	fmt.Println("")
	fmt.Println("Добавьте эти строки в ваш .env файл")
}
