package database

import (
	"gorm.io/gorm"
)

// ClearAll удаляет все данные из всех таблиц БД (порядок с учётом внешних ключей).
// Только для владельца системы. После очистки БД пуста.
func ClearAll(db *gorm.DB) error {
	// Порядок: сначала дочерние таблицы, затем родительские
	tables := []string{
		"poll_votes", "poll_options", "polls",
		"message_reactions", "message_read_receipts", "pinned_messages", "threads",
		"messages",
		"group_call_participants", "group_calls", "calls",
		"story_views", "stories",
		"sessions", "push_subscriptions", "contacts",
		"group_keys",
		"chat_moderation_settings", "chat_warnings", "chat_bans", "moderation_logs",
		"webhooks",
		"stickers", "sticker_packs",
		"channels", "channel_categories", "server_members", "servers",
		"chat_members", "member_events",
		"chats",
		"saved_messages",
		"voice_rooms",
		"maintenance_modes",
		"recruit_applications",
		"user_bots",
		"scheduled_broadcasts",
		"admin_audit_logs",
		"role_ban_history",
		"banned_words",
		"email_templates",
		"domain_allow_block",
		"safety_alerts",
		"suspicious_activities",
		"global_invite_links",
		"system_limits",
		"feature_flags",
		"security_policies",
		"feedbacks",
		"users",
	}

	return db.Transaction(func(tx *gorm.DB) error {
		for _, table := range tables {
			if err := tx.Exec("DELETE FROM " + table).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
