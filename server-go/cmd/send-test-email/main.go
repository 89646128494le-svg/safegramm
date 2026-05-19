// send-test-email — отправить тестовое письмо с сервера (проверка SMTP/.env).
// Запуск на сервере из каталога server-go:
//
//	go run ./cmd/send-test-email your@email.com
//
// или с загрузкой .env из текущей папки:
//
//	cd /path/to/server-go && go run ./cmd/send-test-email your@email.com
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"safegram-server/internal/email"
)

func main() {
	// Загружаем .env из текущей директории (запускайте из каталога server-go)
	_ = godotenv.Load()
	// Если .env не в текущей папке — пробуем рядом с исполняемым файлом
	if _, err := os.Stat(".env"); err != nil {
		execPath, _ := os.Executable()
		if execPath != "" {
			envPath := filepath.Join(filepath.Dir(execPath), ".env")
			_ = godotenv.Overload(envPath)
		}
	}

	to := ""
	if len(os.Args) >= 2 && os.Args[1] != "" {
		to = os.Args[1]
	}
	if to == "" {
		fmt.Println("Использование: go run ./cmd/send-test-email <email>")
		fmt.Println("Пример:       go run ./cmd/send-test-email your@mail.com")
		os.Exit(1)
	}

	ok, msg := email.IsEmailConfigured()
	if !ok {
		fmt.Fprintf(os.Stderr, "Почта не настроена: %s\n", msg)
		os.Exit(2)
	}

	err := email.SendVerificationCode(to, "654321")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Ошибка отправки: %v\n", err)
		os.Exit(3)
	}
	fmt.Printf("Письмо с кодом 654321 отправлено на %s\n", to)
}
