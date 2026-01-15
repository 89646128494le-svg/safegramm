package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

func main() {
	// Получаем параметры из аргументов командной строки
	if len(os.Args) < 3 {
		fmt.Println("Использование: go run main.go <username> <password> [email]")
		fmt.Println("Пример: go run main.go owner mypassword123 owner@example.com")
		os.Exit(1)
	}

	username := os.Args[1]
	password := os.Args[2]
	var email *string
	if len(os.Args) > 3 && strings.TrimSpace(os.Args[3]) != "" {
		emailStr := strings.TrimSpace(os.Args[3])
		email = &emailStr
	}

	// Получаем DATABASE_URL из переменных окружения
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Значение по умолчанию для разработки
		databaseURL = "postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable"
		fmt.Println("⚠️  DATABASE_URL не установлен, используется значение по умолчанию")
	}

	// Подключение к базе данных
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		fmt.Printf("❌ Ошибка подключения к базе данных: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ Подключение к базе данных установлено")

	// Проверка существования пользователя
	var existingUser models.User
	if err := db.Where("LOWER(username) = LOWER(?)", username).First(&existingUser).Error; err == nil {
		fmt.Printf("⚠️  Пользователь '%s' уже существует. Обновляю роль на 'owner'...\n", username)
		
		// Устанавливаем роль owner
		roles := []string{"owner"}
		rolesJSON, _ := json.Marshal(roles)
		existingUser.Roles = string(rolesJSON)
		existingUser.Plan = "premium" // Владелец автоматически получает премиум
		
		// Обновляем пароль, если нужно
		if password != "" {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				fmt.Printf("❌ Ошибка хеширования пароля: %v\n", err)
				os.Exit(1)
			}
			existingUser.PassHash = string(hashedPassword)
		}
		
		if err := db.Save(&existingUser).Error; err != nil {
			fmt.Printf("❌ Ошибка обновления пользователя: %v\n", err)
			os.Exit(1)
		}
		
		fmt.Printf("✅ Пользователь '%s' успешно обновлен с ролью 'owner'\n", username)
		fmt.Printf("   ID: %s\n", existingUser.ID)
		fmt.Printf("   Username: %s\n", existingUser.Username)
		if email != nil {
			fmt.Printf("   Email: %s\n", *email)
		}
		os.Exit(0)
	}

	// Хеширование пароля
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("❌ Ошибка хеширования пароля: %v\n", err)
		os.Exit(1)
	}

	// Создание роли owner
	roles := []string{"owner"}
	rolesJSON, _ := json.Marshal(roles)

	// Создание пользователя
	user := models.User{
		ID:           uuid.New().String(),
		Username:     username,
		PassHash:     string(hashedPassword),
		Email:        email,
		Roles:        string(rolesJSON),
		Plan:         "premium", // Владелец автоматически получает премиум
		Status:       "online",
		ProfileColor: "#3b82f6",
		ShowBio:      true,
		ShowAvatar:   true,
	}

	if err := db.Create(&user).Error; err != nil {
		fmt.Printf("❌ Ошибка создания пользователя: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ Аккаунт владельца успешно создан!")
	fmt.Printf("   ID: %s\n", user.ID)
	fmt.Printf("   Username: %s\n", user.Username)
	if email != nil {
		fmt.Printf("   Email: %s\n", *email)
	}
	fmt.Printf("   Роль: owner\n")
	fmt.Printf("   План: premium\n")
	fmt.Println("\n🎉 Теперь вы можете войти в систему с этими учетными данными!")
}
