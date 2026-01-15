package redis

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

var client *redis.Client
var ctx = context.Background()

// Init инициализирует Redis клиент
func Init(redisURL string) error {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		// Если URL невалидный, пробуем подключиться напрямую
		client = redis.NewClient(&redis.Options{
			Addr: redisURL,
		})
	} else {
		client = redis.NewClient(opt)
	}

	// Проверяем подключение
	_, err = client.Ping(ctx).Result()
	return err
}

// SetOnline устанавливает пользователя как онлайн
func SetOnline(userID string, ttl time.Duration) error {
	return client.Set(ctx, "online:"+userID, "1", ttl).Err()
}

// SetOffline устанавливает пользователя как оффлайн
func SetOffline(userID string) error {
	return client.Del(ctx, "online:"+userID).Err()
}

// IsOnline проверяет, онлайн ли пользователь
func IsOnline(userID string) (bool, error) {
	val, err := client.Exists(ctx, "online:"+userID).Result()
	return val > 0, err
}

// GetOnlineUsers возвращает список онлайн пользователей
func GetOnlineUsers() ([]string, error) {
	keys, err := client.Keys(ctx, "online:*").Result()
	if err != nil {
		return nil, err
	}

	users := make([]string, len(keys))
	for i, key := range keys {
		users[i] = key[7:] // Убираем префикс "online:"
	}
	return users, nil
}

// SetUserStatus устанавливает статус пользователя
func SetUserStatus(userID, status string, ttl time.Duration) error {
	return client.Set(ctx, "status:"+userID, status, ttl).Err()
}

// GetUserStatus возвращает статус пользователя
func GetUserStatus(userID string) (string, error) {
	return client.Get(ctx, "status:"+userID).Result()
}

// Close закрывает соединение с Redis
func Close() error {
	if client != nil {
		return client.Close()
	}
	return nil
}

