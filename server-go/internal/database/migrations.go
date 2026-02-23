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
		&models.Contact{}, &models.Feedback{}, &models.RecruitApplication{},
		&models.UserBot{},
		&models.AdminAuditLog{}, &models.RoleBanHistory{}, &models.BannedWord{},
		&models.EmailTemplate{}, &models.ScheduledBroadcast{}, &models.DomainAllowBlock{},
		&models.SystemLimit{}, &models.FeatureFlag{}, &models.SecurityPolicy{},
		&models.SafetyAlert{}, &models.SuspiciousActivity{}, &models.GlobalInviteLink{},
		&models.Payment{},
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
	db.Exec("CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username))")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_members_user_archived ON chat_members(user_id, archived_at)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chats_type_created ON chats(type, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks(created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_recruit_applications_created ON recruit_applications(created_at DESC)")
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_bots_username ON user_bots(username)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_user_bots_user_id ON user_bots(user_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_created ON admin_audit_logs(admin_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_role_ban_history_user_created ON role_ban_history(user_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_safety_alerts_created ON safety_alerts(created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_suspicious_activities_user_created ON suspicious_activities(user_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_text_search ON messages(text)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_payments_provider_status ON payments(provider, status)")
	log.Println("Database indexes created successfully")
	return nil
}