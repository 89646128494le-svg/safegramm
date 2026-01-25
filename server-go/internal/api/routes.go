package api

import (
	"safegram-server/internal/config"
	"safegram-server/internal/websocket"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRoutes настраивает все маршруты API
func SetupRoutes(router *gin.Engine, db *gorm.DB, wsHub *websocket.Hub, cfg *config.Config) {
	api := router.Group("/api")

	// Публичные маршруты (с rate limiting)
	api.POST("/auth/register", AuthRateLimitMiddleware(), Register(db, cfg))
	api.POST("/auth/login", AuthRateLimitMiddleware(), Login(db, cfg))
	api.POST("/auth/send-email-code", AuthRateLimitMiddleware(), SendEmailCode(db))
	api.POST("/auth/send-login-email-code", AuthRateLimitMiddleware(), SendLoginEmailCode(db))
	api.POST("/auth/verify-email", AuthRateLimitMiddleware(), VerifyEmail(db))
	
	// Тестовый endpoint для просмотра всех email шаблонов (только development)
	api.POST("/test/email", AuthRateLimitMiddleware(), TestEmailTemplates(db))

	// Защищенные маршруты (требуют аутентификации)
	protected := api.Group("")
	protected.Use(authMiddleware(cfg))
	protected.Use(RateLimitMiddleware())

	// WebSocket endpoint
	router.GET("/ws", handleWebSocket(wsHub, cfg))

	// Пользователи
	protected.GET("/users", GetUsers(db))
	protected.GET("/users/me", GetCurrentUser(db))
	protected.GET("/users/search", SearchUsers(db))
	protected.GET("/users/:id", GetUserProfile(db))
	protected.PATCH("/users/me", UpdateUser(db))
	protected.POST("/users/me", UpdateUser(db))
	protected.POST("/users/me/avatar", UploadAvatar(db))
	protected.POST("/users/me/status", UpdateUserStatus(db))
	protected.GET("/users/me/notifications", GetUserNotifications(db))
	protected.POST("/users/me/notifications", UpdateUserNotifications(db))
	protected.GET("/users/me/privacy", GetUserPrivacy(db))
	protected.POST("/users/me/privacy", UpdateUserPrivacy(db))
	protected.POST("/users/me/password", ChangePassword(db))
	protected.POST("/users/me/2fa/generate", Generate2FA(db))
	protected.POST("/users/me/2fa/enable", Enable2FA(db))
	protected.POST("/users/me/2fa/disable", Disable2FA(db))
	protected.POST("/users/me/recovery", GenerateRecoveryCodes(db))
	protected.POST("/users/me/pin", SetPIN(db))
	
	// Сессии
	protected.GET("/users/me/sessions", GetSessions(db))
	protected.DELETE("/users/me/sessions/:id", TerminateSession(db))
	protected.POST("/users/me/sessions/terminate-all", TerminateAllOtherSessions(db))

	// Статистика
	protected.GET("/chats/:id/statistics", GetChatStatistics(db))

	// Боты
	protected.GET("/bots", GetBots(db))
	protected.POST("/bots", CreateBot(db))
	protected.POST("/bots/:id/toggle", ToggleBot(db))
	protected.DELETE("/bots/:id", DeleteBot(db))

	// Календарь
	protected.GET("/calendar/events", GetCalendarEvents(db))
	protected.POST("/calendar/events", CreateCalendarEvent(db))
	protected.DELETE("/calendar/events/:id", DeleteCalendarEvent(db))

	// Задачи
	protected.GET("/todos", GetTodos(db))
	protected.POST("/todos", CreateTodo(db))
	protected.PATCH("/todos/:id", UpdateTodo(db))
	protected.DELETE("/todos/:id", DeleteTodo(db))

	// Чаты
	protected.GET("/chats", GetChats(db))
	protected.POST("/chats", CreateChat(db))
	protected.GET("/chats/:id", GetChat(db))
	protected.GET("/chats/:id/messages", GetMessages(db))
	protected.POST("/chats/:id/messages", CreateMessage(db, wsHub)) // Альтернативный маршрут для создания сообщений
	protected.POST("/chats/:id/read", MarkChatRead(db, wsHub))      // Отметить все сообщения в чате как прочитанные
	protected.GET("/chats/:id/pinned", GetPinnedMessages(db))       // Получить закрепленные сообщения
	protected.GET("/chats/:id/export", ExportChat(db))              // Экспорт истории чата
	protected.DELETE("/chats/:id", DeleteChat(db))                  // Удалить чат
	protected.POST("/chats/:id/archive", ArchiveChat(db))           // Архивировать чат
	protected.POST("/chats/:id/unarchive", UnarchiveChat(db))       // Разархивировать чат
	protected.POST("/chats/:id/attach", UploadAttachment(db, wsHub))
	protected.GET("/chats/:id/attachments", GetAttachments(db)) // Получение медиа файлов

	// Сообщения
	protected.POST("/messages", CreateMessage(db, wsHub))
	protected.POST("/messages/:id/react", AddReaction(db, wsHub))
	protected.POST("/messages/:id/edit", EditMessage(db, wsHub))
	protected.POST("/messages/:id/delete", DeleteMessage(db, wsHub))
	protected.POST("/messages/:id/location", AddLocation(db, wsHub))
	protected.POST("/messages/:id/read", MarkMessageRead(db, wsHub))
	protected.GET("/messages/:id/read", GetMessageReadReceipts(db))
	protected.POST("/messages/:id/pin", PinMessage(db, wsHub))         // Закрепить сообщение
	protected.POST("/messages/:id/unpin", UnpinMessage(db, wsHub))     // Открепить сообщение
	protected.POST("/messages/:id/forward", ForwardMessage(db, wsHub)) // Переслать сообщение
	protected.POST("/messages/:id/save", SaveMessage(db))              // Сохранить сообщение в избранное
	protected.POST("/messages/:id/unsave", UnsaveMessage(db))          // Удалить сообщение из избранного
	protected.GET("/messages/saved", GetSavedMessages(db))             // Получить сохраненные сообщения
	protected.POST("/messages/:id/poll", CreatePoll(db, wsHub))        // Создать опрос в сообщении
	protected.POST("/polls/:id/vote", VotePoll(db, wsHub))             // Проголосовать в опросе (по pollId)
	protected.POST("/messages/:id/poll/vote", VotePollByMessage(db, wsHub)) // Проголосовать в опросе (по messageId)
	protected.GET("/polls/:id", GetPoll(db))                           // Получить информацию об опросе
	protected.GET("/search", UniversalSearch(db))                      // Универсальный поиск
	protected.GET("/messages/search", SearchMessages(db))              // Поиск сообщений (старый endpoint)

	// Истории (Stories)
	protected.POST("/stories", CreateStory(db))        // Создать историю
	protected.GET("/stories", GetStories(db))          // Получить активные истории
	protected.POST("/stories/:id/view", ViewStory(db)) // Отметить историю как просмотренную
	protected.DELETE("/stories/:id", DeleteStory(db))  // Удалить историю

	// Push уведомления
	router.GET("/api/push/vapid_public", GetVAPIDPublicKey()) // Публичный VAPID ключ (без авторизации)
	protected.POST("/push/subscribe", SubscribePush(db))      // Подписаться на push (полный путь: /api/push/subscribe)
	protected.POST("/push/unsubscribe", UnsubscribePush(db))  // Отписаться от push (полный путь: /api/push/unsubscribe)
	protected.POST("/push/test", TestPush(db))                // Тестовое push-уведомление (полный путь: /api/push/test)

	// Звонки
	protected.POST("/calls", CreateCall(db))                    // Создать запись о звонке
	protected.GET("/calls", GetCallHistory(db))                 // Получить историю звонков
	protected.GET("/calls/missed", GetMissedCalls(db))          // Получить пропущенные звонки
	protected.POST("/calls/:id/read", MarkCallAsRead(db))       // Отметить звонок как прочитанный
	protected.POST("/calls/recordings", UploadCallRecording(db)) // Загрузить запись звонка
	protected.POST("/calls/group", CreateGroupCall(db))         // Создать запись о групповом звонке
	protected.GET("/calls/group", GetGroupCallHistory(db))      // Получить историю групповых звонков

	// Стикеры
	protected.GET("/sticker-packs", GetStickerPacks(db))
	protected.GET("/sticker-packs/:packId/stickers", GetStickers(db))

	// Треды
	protected.POST("/chats/:id/threads", CreateThread(db))
	protected.GET("/chats/:id/threads", GetThreads(db))
	protected.GET("/threads/:id/messages", GetThreadMessages(db))

	// Серверы
	protected.POST("/servers", CreateServer(db))
	protected.GET("/servers", GetServers(db))
	// Более специфичные маршруты должны быть раньше общих
	protected.POST("/servers/:id/channels", CreateChannel(db))
	protected.GET("/servers/:id/channels", GetChannels(db))
	protected.DELETE("/servers/:id/channels/:channelId", DeleteChannel(db))
	protected.PATCH("/servers/:id/channels/:channelId/category", SetChannelCategory(db))
	protected.POST("/servers/:id/categories", CreateChannelCategory(db))
	protected.GET("/servers/:id/categories", GetChannelCategories(db))
	protected.DELETE("/servers/:id/categories/:categoryId", DeleteChannelCategory(db))
	protected.GET("/servers/:id/members", GetServerMembers(db))
	protected.POST("/servers/:id/members/bulk", BulkAddServerMembers(db))
	protected.PATCH("/servers/:id/members/:userId/role", SetServerMemberRole(db))
	protected.POST("/servers/:id/join", JoinServer(db))
	protected.POST("/servers/:id/leave", LeaveServer(db))
	protected.POST("/servers/:id/invite-link", GenerateServerInviteLink(db))
	protected.POST("/servers/join/:link", JoinByServerInviteLink(db))
	protected.GET("/servers/:id/history", GetServerMemberHistory(db))
	protected.GET("/servers/:id", GetServer(db))

	// Группы
	protected.POST("/groups", CreateGroup(db))
	protected.POST("/groups/:id/join", JoinGroup(db))
	protected.POST("/groups/:id/leave", LeaveGroup(db))
	protected.POST("/groups/:id/members", AddGroupMember(db))
	protected.POST("/groups/:id/members/bulk", BulkAddGroupMembers(db))
	protected.PATCH("/groups/:id/members/:userId/role", SetGroupMemberRole(db))
	protected.DELETE("/groups/:id/members/:userId", RemoveGroupMember(db))
	protected.PATCH("/groups/:id", UpdateGroup(db))
	protected.GET("/groups/:id/history", GetGroupMemberHistory(db))
	protected.GET("/groups/:id/stats", GetGroupStats(db))

	// Модерация чатов (группы/каналы)
	protected.GET("/chats/:id/moderation/settings", GetChatModerationSettings(db))
	protected.POST("/chats/:id/moderation/settings", UpdateChatModerationSettings(db))
	protected.GET("/chats/:id/moderation/queue", GetModerationQueue(db))
	protected.GET("/chats/:id/moderation/logs", GetModerationLogs(db))
	protected.POST("/chats/:id/moderation/ban", BanUser(db))
	protected.POST("/chats/:id/moderation/unban", UnbanUser(db))
	protected.POST("/messages/:id/moderation/approve", ApproveMessage(db, wsHub))
	protected.POST("/messages/:id/moderation/reject", RejectMessage(db))

	// Интеграции (вебхуки) для чатов
	protected.GET("/chats/:id/webhooks", GetChatWebhooks(db))
	protected.POST("/chats/:id/webhooks", CreateChatWebhook(db))
	protected.DELETE("/chats/:id/webhooks/:webhookId", DeleteChatWebhook(db))
	
	// Приглашения по ссылке
	protected.POST("/chats/:id/invite-link", GenerateInviteLink(db))
	protected.POST("/chats/join/:link", JoinByInviteLink(db))
	
	// Групповое E2EE
	protected.GET("/chats/:id/group-key", GetGroupKey(db))
	protected.POST("/chats/:id/group-key/init", InitializeGroupKey(db))
	protected.POST("/chats/:id/group-key/update", UpdateGroupKey(db))
	protected.GET("/chats/:id/group-key/version", GetGroupKeyVersion(db))

	// Админ панель
	protected.GET("/admin/users", RequireAdmin(db), GetAdminUsers(db))
	protected.POST("/admin/users/:id/block", RequireAdmin(db), BlockUser(db))
	protected.POST("/admin/users/:id/unblock", RequireAdmin(db), UnblockUser(db))
	protected.POST("/admin/users/:id/promote", RequireAdmin(db), PromoteUser(db))
	protected.POST("/admin/users/:id/demote", RequireAdmin(db), DemoteUser(db))
	protected.GET("/admin/stats", RequireAdmin(db), GetAdminStats(db))
	protected.GET("/admin/feedback", RequireAdmin(db), GetAdminFeedback(db))
	protected.GET("/admin/reports", RequireAdmin(db), GetAdminReports(db))
	protected.GET("/admin/modqueue", RequireAdmin(db), GetAdminModQueue(db))
	protected.POST("/admin/approve/:id", RequireAdmin(db), ApproveModItem(db))

	// Панель владельца (только для owner)
	protected.GET("/owner/dashboard", RequireOwner(db), GetOwnerDashboard(db))
	protected.POST("/owner/users/:id/plan", RequireOwner(db), SetUserPlan(db))
	protected.POST("/owner/users/:id/role", RequireOwner(db), SetUserRole(db))
	protected.DELETE("/owner/users/:id", RequireOwner(db), DeleteUser(db))
	protected.GET("/owner/settings", RequireOwner(db), GetSystemSettings(db))
	protected.POST("/owner/settings", RequireOwner(db), UpdateSystemSettings(db))
	protected.GET("/owner/premium/stats", RequireOwner(db), GetPremiumStats(db))

	// Премиум подписка
	protected.GET("/premium", GetPremiumInfo(db))                                    // Информация о премиум подписке текущего пользователя
	protected.POST("/premium/subscribe/:id", RequireOwner(db), SubscribePremium(db)) // Активировать премиум (только владелец)

	// Управление сервисами (для admin и owner)
	protected.GET("/admin/services", RequireAdmin(db), GetServicesStatus(db))
	protected.POST("/admin/services/:id/start", RequireAdmin(db), StartService(db))
	protected.POST("/admin/services/:id/stop", RequireAdmin(db), StopService(db))
	protected.POST("/admin/services/:id/restart", RequireAdmin(db), RestartService(db))
	
	// Персональные сообщения от администрации
	protected.POST("/admin/send-email", RequireAdmin(db), SendPersonalEmail(db))
	protected.POST("/admin/broadcast-email", RequireAdmin(db), BroadcastPersonalEmail(db))
	
	// Технические работы
	protected.POST("/admin/maintenance", RequireAdmin(db), SendMaintenanceNotificationToAll(db))
	protected.GET("/maintenance/status", GetMaintenanceStatus(db)) // Публичный endpoint
	protected.POST("/admin/maintenance/disable", RequireAdmin(db), DisableMaintenance(db))

	// Webhook настройки (для admin и owner)
	protected.GET("/admin/webhook", RequireAdmin(db), GetWebhookSettings)
	protected.POST("/admin/webhook", RequireAdmin(db), UpdateWebhookSettings(db, cfg))
	protected.POST("/admin/webhook/test", RequireAdmin(db), TestWebhook)
	protected.GET("/admin/logs", RequireAdmin(db), GetLogs)

	// WebRTC
	protected.GET("/rtc/ice", GetICEServers())

	// Голосовые комнаты
	protected.POST("/chats/:id/voice-room", CreateVoiceRoom(db))
	protected.GET("/chats/:id/voice-room", GetVoiceRoom(db))
	protected.POST("/voice-rooms/:roomId/end", EndVoiceRoom(db))

	// Статические файлы (загрузки) - должно быть до protected, чтобы не требовалась аутентификация
	router.Static("/uploads", "./uploads")
	router.StaticFile("/favicon.ico", "./favicon.ico")
}
