package database

import (
	"log"

	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// AutoMigrate выполняет автоматические миграции всех моделей
func AutoMigrate(db *gorm.DB) error {
	log.Println("🔄 Starting database migrations...")

	// Удаляем неправильные внешние ключи, если они существуют
	db.Exec("ALTER TABLE polls DROP CONSTRAINT IF EXISTS fk_messages_poll")
	db.Exec("ALTER TABLE polls DROP CONSTRAINT IF EXISTS fk_polls_message")

	// Миграция всех моделей
	err := db.AutoMigrate(
		&models.User{},
		&models.Chat{},
		&models.ChatMember{},
		&models.MemberEvent{},
		&models.Message{},
		&models.MessageReaction{},
		&models.MessageReadReceipt{},
		&models.PinnedMessage{},
		&models.Thread{},
		&models.Server{},
		&models.ServerMember{},
		&models.ChannelCategory{},
		&models.Channel{},
		&models.GroupKey{},
		&models.ChatModerationSettings{},
		&models.ChatWarning{},
		&models.ChatBan{},
		&models.ModerationLog{},
		&models.Webhook{},
		&models.StickerPack{},
		&models.Sticker{},
		&models.VoiceRoom{},
		&models.PushSubscription{},
		&models.SavedMessage{},
		&models.Poll{},
		&models.PollOption{},
		&models.PollVote{},
		&models.Story{},
		&models.StoryView{},
		&models.Call{},
		&models.GroupCall{},
		&models.GroupCallParticipant{},
		&models.Session{},
	)

	if err != nil {
		return err
	}

	log.Println("✅ Database migrations completed successfully")
	return nil
}

// CreateIndexes создает дополнительные индексы для оптимизации
func CreateIndexes(db *gorm.DB) error {
	log.Println("🔍 Creating database indexes...")

	// Индексы для пользователей
	// Сначала удаляем constraint если он существует
	db.Exec("ALTER TABLE users DROP CONSTRAINT IF EXISTS idx_users_email")
	db.Exec("DROP INDEX IF EXISTS idx_users_email")
	// Уникальный индекс на email только для не-NULL и не-пустых значений
	if err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND email != ''").Error; err != nil {
		log.Printf("Warning: failed to create index on users.email: %v", err)
	}

	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)").Error; err != nil {
		log.Printf("Warning: failed to create index on users.status: %v", err)
	}

	// Индексы для сообщений
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC)").Error; err != nil {
		log.Printf("Warning: failed to create index on messages: %v", err)
	}

	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC)").Error; err != nil {
		log.Printf("Warning: failed to create index on messages.sender: %v", err)
	}

	// Индексы для участников чата
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id)").Error; err != nil {
		log.Printf("Warning: failed to create index on chat_members.user: %v", err)
	}

	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id)").Error; err != nil {
		log.Printf("Warning: failed to create index on chat_members.chat: %v", err)
	}

	log.Println("✅ Database indexes created successfully")
	return nil
}

