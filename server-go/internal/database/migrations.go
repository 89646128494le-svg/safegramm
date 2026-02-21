package database

import (
	"log"

	"gorm.io/gorm"
	"safegram-server/internal/models"
)

func AutoMigrate(db *gorm.DB) error {
	log.Println("Starting database migrations...")
	if db.Dialector.Name() == "postgres" {
		db.Exec("ALTER TABLE polls DROP CONSTRAINT IF EXISTS fk_messages_poll")
		db.Exec("ALTER TABLE polls DROP CONSTRAINT IF EXISTS fk_polls_message")
	}
	err := db.AutoMigrate(
		&models.User{}, &models.Chat{}, &models.ChatMember{}, &models.MemberEvent{}, &models.Message{},
		&models.MessageReaction{}, &models.MessageReadReceipt{}, &models.PinnedMessage{}, &models.Thread{},
		&models.Server{}, &models.ServerMember{}, &models.ChannelCategory{}, &models.Channel{}, &models.GroupKey{},
		&models.ChatModerationSettings{}, &models.ChatWarning{}, &models.ChatBan{}, &models.ModerationLog{},
		&models.Webhook{}, &models.StickerPack{}, &models.Sticker{}, &models.VoiceRoom{}, &models.PushSubscription{},
		&models.SavedMessage{}, &models.Poll{}, &models.PollOption{}, &models.PollVote{}, &models.Story{}, &models.StoryView{},
		&models.Call{}, &models.GroupCall{}, &models.GroupCallParticipant{}, &models.Session{}, &models.MaintenanceMode{},
		&models.Contact{},
	)
	if err != nil { return err }
	log.Println("Database migrations completed successfully")
	return nil
}

func CreateIndexes(db *gorm.DB) error {
	log.Println("Creating database indexes...")
	if db.Dialector.Name() == "postgres" { db.Exec("ALTER TABLE users DROP CONSTRAINT IF EXISTS idx_users_email") }
	db.Exec("DROP INDEX IF EXISTS idx_users_email")
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND email != ''")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id)")
	log.Println("Database indexes created successfully")
	return nil
}