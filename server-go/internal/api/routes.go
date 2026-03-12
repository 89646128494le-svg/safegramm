package api

import (
	"safegram-server/internal/config"
	"safegram-server/internal/models"
	"safegram-server/internal/websocket"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRoutes настраивает все маршруты API
func SetupRoutes(router *gin.Engine, db *gorm.DB, wsHub *websocket.Hub, cfg *config.Config) {
	setNotificationDB(db)

	wsHub.SetChatPeerResolver(func(chatID, excludeUserID string) []string {
		var members []models.ChatMember
		if err := db.Where("chat_id = ? AND user_id != ? AND deleted_at IS NULL", chatID, excludeUserID).Find(&members).Error; err != nil {
			return nil
		}
		ids := make([]string, 0, len(members))
		for _, m := range members {
			ids = append(ids, m.UserID)
		}
		return ids
	})

	api := router.Group("/api")

	// Публичные маршруты (с rate limiting)
	api.GET("/auth/check-username", AuthRateLimitMiddleware(), CheckUsername(db))
	api.GET("/auth/check-email", AuthRateLimitMiddleware(), CheckEmail(db))
	api.POST("/auth/register", AuthRateLimitMiddleware(), Register(db, cfg))
	api.POST("/auth/login", AuthRateLimitMiddleware(), Login(db, cfg))
	api.POST("/auth/send-email-code", AuthRateLimitMiddleware(), SendEmailCode(db))
	api.POST("/auth/send-login-email-code", AuthRateLimitMiddleware(), SendLoginEmailCode(db))
	api.GET("/auth/email-status", AuthRateLimitMiddleware(), GetEmailStatus)
	api.POST("/auth/verify-email", AuthRateLimitMiddleware(), VerifyEmail(db))
	api.POST("/auth/forgot-password", AuthRateLimitMiddleware(), ForgotPassword(db))
	api.POST("/auth/reset-password", AuthRateLimitMiddleware(), ResetPassword(db))
	api.GET("/exports/:token", DownloadAccountExport())

	// Тестовый endpoint для просмотра всех email шаблонов (только development)
	api.POST("/test/email", AuthRateLimitMiddleware(), TestEmailTemplates(db))

	// Safety AI на базе Gemini, gemini-1.5-flash
	api.POST("/safety/ask", AskGemini)

	// Публичный статус техработ (без авторизации — для баннера на фронте)
	api.GET("/maintenance/status", GetMaintenanceStatus(db))

	// Набор тестировщиков и хелперов (публичная заявка, с rate limit)
	api.POST("/recruit", AuthRateLimitMiddleware(), SubmitRecruit(db))

	// Публичная страница приглашения по коду (без авторизации)
	api.GET("/invite/:code", GetInviteByCode(db))

	// Платежи: вебхуки (без авторизации, проверка подписи внутри)
	api.POST("/webhooks/stripe", StripeWebhook(db))
	api.POST("/webhooks/yookassa", YooKassaWebhook(db))
	api.GET("/plans", GetPlans(db))

	// Защищенные маршруты (требуют аутентификации)
	protected := api.Group("")
	protected.Use(authMiddleware(cfg, db))
	protected.Use(RateLimitMiddleware())
	protected.Use(MaintenanceAccessMiddleware(db))

	// WebSocket endpoint
	router.GET("/ws", handleWebSocket(wsHub, cfg, db))

	// Контакты
	protected.GET("/contacts/list", ListContacts(db))
	protected.GET("/contacts/search", SearchRateLimitMiddleware(), ContactsSearch(db))
	protected.POST("/contacts/add", AddContact(db))
	protected.POST("/contacts/remove", RemoveContact(db))

	// Пользователи
	protected.GET("/users", GetUsers(db))
	protected.GET("/users/me", GetCurrentUser(db))
	protected.GET("/users/me/export", ExportMyData(db))
	protected.DELETE("/users/me", DeleteMyAccount(db))
	protected.GET("/users/search", SearchRateLimitMiddleware(), SearchUsers(db))
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
	protected.DELETE("/users/me/pin", RemovePIN(db))
	protected.POST("/users/me/email/change/request", RequestEmailChange(db))
	protected.POST("/users/me/email/change/confirm", ConfirmEmailChange(db))

	// Сессии
	protected.GET("/users/me/sessions", GetSessions(db))
	protected.DELETE("/users/me/sessions/:id", TerminateSession(db))
	protected.POST("/users/me/sessions/terminate-all", TerminateAllOtherSessions(db))

	// Статистика
	protected.GET("/chats/:id/statistics", GetChatStatistics(db))

	// Боты (BotFather-style: создание, токен при create/revoke)
	protected.GET("/bots", GetBots(db))
	protected.POST("/bots", CreateBot(db))
	protected.GET("/bots/:id", GetBot(db))
	protected.PATCH("/bots/:id", UpdateBot(db))
	protected.POST("/bots/:id/revoke", RevokeBotToken(db))
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
	protected.POST("/messages/:id/pin", PinMessage(db, wsHub))              // Закрепить сообщение
	protected.POST("/messages/:id/unpin", UnpinMessage(db, wsHub))          // Открепить сообщение
	protected.POST("/messages/:id/forward", ForwardMessage(db, wsHub))      // Переслать сообщение
	protected.POST("/messages/:id/save", SaveMessage(db))                   // Сохранить сообщение в избранное
	protected.POST("/messages/:id/unsave", UnsaveMessage(db))               // Удалить сообщение из избранного
	protected.GET("/messages/saved", GetSavedMessages(db))                  // Получить сохраненные сообщения
	protected.POST("/messages/:id/poll", CreatePoll(db, wsHub))             // Создать опрос в сообщении
	protected.POST("/polls/:id/vote", VotePoll(db, wsHub))                  // Проголосовать в опросе (по pollId)
	protected.POST("/messages/:id/poll/vote", VotePollByMessage(db, wsHub)) // Проголосовать в опросе (по messageId)
	protected.GET("/polls/:id", GetPoll(db))                                // Получить информацию об опросе
	protected.GET("/search", SearchRateLimitMiddleware(), UniversalSearch(db))
	protected.GET("/messages/search", SearchRateLimitMiddleware(), SearchMessages(db))

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
	protected.POST("/calls", CreateCall(db))                     // Создать запись о звонке
	protected.GET("/calls", GetCallHistory(db))                  // Получить историю звонков
	protected.GET("/calls/missed", GetMissedCalls(db))           // Получить пропущенные звонки
	protected.POST("/calls/:id/read", MarkCallAsRead(db))        // Отметить звонок как прочитанный
	protected.POST("/calls/recordings", UploadCallRecording(db)) // Загрузить запись звонка
	protected.POST("/calls/group", CreateGroupCall(db))          // Создать запись о групповом звонке
	protected.GET("/calls/group", GetGroupCallHistory(db))       // Получить историю групповых звонков

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
	protected.POST("/servers/:id/channels", CreateChannel(db))
	protected.GET("/servers/:id/channels", GetChannels(db))
	protected.GET("/servers/:id/voice-state", GetServerVoiceState(db, wsHub))
	protected.DELETE("/servers/:id/channels/:channelId", DeleteChannel(db))
	protected.PATCH("/servers/:id/channels/:channelId/category", SetChannelCategory(db))
	protected.POST("/servers/:id/categories", CreateChannelCategory(db))
	protected.GET("/servers/:id/categories", GetChannelCategories(db))
	protected.DELETE("/servers/:id/categories/:categoryId", DeleteChannelCategory(db))
	protected.GET("/servers/:id/members", GetServerMembers(db))
	protected.POST("/servers/:id/members/bulk", BulkAddServerMembers(db))
	protected.PATCH("/servers/:id/members/:userId/role", SetServerMemberRole(db))
	protected.GET("/servers/:id/roles", GetServerRoles(db))
	protected.POST("/servers/:id/roles", CreateServerRole(db))
	protected.PATCH("/servers/:id/roles/:roleId", UpdateServerRole(db))
	protected.DELETE("/servers/:id/roles/:roleId", DeleteServerRole(db))
	protected.GET("/servers/:id/members/:userId/roles", GetServerMemberRoles(db))
	protected.PUT("/servers/:id/members/:userId/roles", SetServerMemberRoles(db))
	protected.PATCH("/servers/:id", UpdateServer(db))
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

	// Админ панель (2FA: статус и верификация — без проверки кода; остальные роуты требуют код)
	allStaffRoles := []string{RoleSupportL1, RoleSupportLead, RoleModerator, RoleRiskAnalyst, RoleSafety, RoleBillingManager, RoleReleaseManager, RoleSysadmin, RoleOwner}
	supportRoles := []string{RoleSupportL1, RoleSupportLead, RoleSysadmin, RoleOwner}
	supportLeadRoles := []string{RoleSupportLead, RoleSysadmin, RoleOwner}
	moderationRoles := []string{RoleModerator, RoleSafety, RoleSysadmin, RoleOwner}
	riskRoles := []string{RoleRiskAnalyst, RoleSafety, RoleSysadmin, RoleOwner}
	safetyRoles := []string{RoleSafety, RoleSysadmin, RoleOwner}
	billingRoles := []string{RoleBillingManager, RoleSysadmin, RoleOwner}
	releaseRoles := []string{RoleReleaseManager, RoleSysadmin, RoleOwner}
	opsRoles := []string{RoleBillingManager, RoleReleaseManager, RoleSysadmin, RoleOwner}
	sysadminRoles := []string{RoleSysadmin, RoleOwner}
	adminEntry := func(roles []string, handler gin.HandlerFunc) []gin.HandlerFunc {
		return []gin.HandlerFunc{RequireStaffRoles(db, roles...), handler}
	}
	adminProtected := func(roles []string, handler gin.HandlerFunc) []gin.HandlerFunc {
		return []gin.HandlerFunc{RequireStaffRoles(db, roles...), RequireAdmin2FA(db, cfg), handler}
	}

	protected.GET("/admin/2fa-status", adminEntry(allStaffRoles, GetAdmin2FAStatus(db))...)
	protected.POST("/admin/verify-2fa", adminEntry(allStaffRoles, PostAdminVerify2FA(db, cfg))...)
	protected.GET("/admin/users", adminProtected(sysadminRoles, GetAdminUsers(db))...)
	protected.POST("/admin/users/:id/block", adminProtected(sysadminRoles, BlockUser(db, wsHub))...)
	protected.POST("/admin/users/:id/unblock", adminProtected(sysadminRoles, UnblockUser(db))...)
	protected.POST("/admin/users/:id/suspend", adminProtected(sysadminRoles, SuspendUser(db, wsHub))...)
	protected.POST("/admin/users/:id/unsuspend", adminProtected(sysadminRoles, UnsuspendUser(db))...)
	protected.POST("/admin/users/:id/promote", adminProtected(sysadminRoles, PromoteUser(db))...)
	protected.POST("/admin/users/:id/demote", adminProtected(sysadminRoles, DemoteUser(db))...)
	protected.GET("/admin/stats", adminProtected(sysadminRoles, GetAdminStats(db))...)
	protected.GET("/admin/analytics", adminProtected(sysadminRoles, GetAdminAnalytics(db))...)
	protected.GET("/admin/bans", adminProtected(moderationRoles, GetAdminBans(db))...)
	protected.POST("/admin/bans", adminProtected(moderationRoles, CreateAdminBan(db))...)
	protected.DELETE("/admin/bans/:id", adminProtected(moderationRoles, DeleteAdminBan(db))...)
	protected.GET("/admin/maintenance", adminProtected(releaseRoles, GetAdminMaintenance(db))...)
	protected.GET("/admin/system/health", adminProtected(releaseRoles, GetSystemHealth(db))...)
	protected.GET("/admin/feedback", adminProtected(supportRoles, GetAdminFeedback(db))...)
	protected.PATCH("/admin/feedback/:id", adminProtected(supportRoles, PatchAdminFeedback(db))...)
	protected.GET("/admin/recruit", adminProtected(supportLeadRoles, GetAdminRecruit(db))...)
	protected.POST("/admin/recruit/:id/approve", adminProtected(supportLeadRoles, ApproveRecruitApplication(db))...)
	protected.POST("/admin/recruit/:id/decline", adminProtected(supportLeadRoles, DeclineRecruitApplication(db))...)
	protected.GET("/admin/reports", adminProtected(moderationRoles, GetAdminReports(db))...)
	protected.GET("/admin/modqueue", adminProtected(moderationRoles, GetAdminModQueue(db))...)
	protected.POST("/admin/approve/:id", adminProtected(moderationRoles, ApproveModItem(db))...)

	// Админ: пользователи (расширенные)
	protected.POST("/admin/users/bulk", adminProtected(sysadminRoles, AdminUsersBulk(db, wsHub))...)
	protected.GET("/admin/users/export", adminProtected(sysadminRoles, GetAdminUsersExport(db))...)
	protected.GET("/admin/users/:id/history", adminProtected(sysadminRoles, GetAdminUserHistory(db))...)
	protected.GET("/admin/users/:id/recovery-codes", adminProtected(sysadminRoles, GetAdminUserRecoveryCodes(db))...)
	protected.POST("/admin/users/:id/recovery-codes/reset", adminProtected(sysadminRoles, PostAdminUserRecoveryCodesReset(db))...)
	protected.GET("/admin/users/:id/sessions", adminProtected(sysadminRoles, GetAdminUserSessions(db))...)
	protected.DELETE("/admin/users/:id/sessions/:sid", adminProtected(sysadminRoles, DeleteAdminUserSession(db))...)

	// Админ: модерация контента
	protected.GET("/admin/messages/search", adminProtected(moderationRoles, GetAdminMessagesSearch(db))...)
	protected.GET("/admin/media-queue", adminProtected(moderationRoles, GetAdminMediaQueue(db))...)
	protected.POST("/admin/messages/:id/moderation", adminProtected(moderationRoles, PostAdminMessageModeration(db))...)
	protected.GET("/admin/sticker-packs", adminProtected(moderationRoles, GetAdminStickerPacks(db))...)
	protected.POST("/admin/sticker-packs/:id/approve", adminProtected(moderationRoles, PostAdminStickerPackApprove(db))...)
	protected.POST("/admin/sticker-packs/:id/reject", adminProtected(moderationRoles, PostAdminStickerPackReject(db))...)
	protected.GET("/admin/banned-words", adminProtected(moderationRoles, GetAdminBannedWords(db))...)
	protected.POST("/admin/banned-words", adminProtected(moderationRoles, PostAdminBannedWord(db))...)
	protected.PATCH("/admin/banned-words/:id", adminProtected(moderationRoles, PatchAdminBannedWord(db))...)
	protected.DELETE("/admin/banned-words/:id", adminProtected(moderationRoles, DeleteAdminBannedWord(db))...)

	// Админ: безопасность
	protected.GET("/admin/suspicious-activity", adminProtected(riskRoles, GetAdminSuspiciousActivity(db))...)
	protected.GET("/admin/security-policy", adminProtected(safetyRoles, GetAdminSecurityPolicy(db))...)
	protected.PATCH("/admin/security-policy", adminProtected(safetyRoles, PatchAdminSecurityPolicy(db))...)
	protected.GET("/admin/safety-alerts", adminProtected(safetyRoles, GetAdminSafetyAlerts(db))...)
	protected.POST("/admin/safety-alerts/:id/resolve", adminProtected(safetyRoles, PostAdminSafetyAlertResolve(db))...)

	// Админ: коммуникация
	protected.GET("/admin/email-templates", adminProtected(releaseRoles, GetAdminEmailTemplates(db))...)
	protected.POST("/admin/email-templates", adminProtected(releaseRoles, PostAdminEmailTemplate(db))...)
	protected.PATCH("/admin/email-templates/:id", adminProtected(releaseRoles, PatchAdminEmailTemplate(db))...)
	protected.GET("/admin/scheduled-broadcasts", adminProtected(releaseRoles, GetAdminScheduledBroadcasts(db))...)
	protected.POST("/admin/scheduled-broadcasts", adminProtected(releaseRoles, PostAdminScheduledBroadcast(db))...)
	protected.GET("/admin/domain-list", adminProtected(releaseRoles, GetAdminDomainList(db))...)
	protected.POST("/admin/domain-list", adminProtected(releaseRoles, PostAdminDomainList(db))...)
	protected.DELETE("/admin/domain-list/:id", adminProtected(releaseRoles, DeleteAdminDomainList(db))...)
	protected.GET("/admin/invite-links", adminProtected(releaseRoles, GetAdminInviteLinks(db))...)
	protected.POST("/admin/invite-links", adminProtected(releaseRoles, PostAdminInviteLink(db))...)
	protected.PATCH("/admin/invite-links/:id", adminProtected(releaseRoles, PatchAdminInviteLink(db))...)
	protected.DELETE("/admin/invite-links/:id", adminProtected(releaseRoles, DeleteAdminInviteLink(db))...)

	// Админ: система и интеграции
	protected.GET("/admin/bots", adminProtected(sysadminRoles, GetAdminBots(db))...)
	protected.POST("/admin/bots/:id/disable", adminProtected(sysadminRoles, PostAdminBotDisable(db))...)
	protected.POST("/admin/bots/:id/enable", adminProtected(sysadminRoles, PostAdminBotEnable(db))...)
	protected.GET("/admin/limits", adminProtected(sysadminRoles, GetAdminLimits(db))...)
	protected.PATCH("/admin/limits", adminProtected(sysadminRoles, PatchAdminLimits(db))...)
	protected.GET("/admin/feature-flags", adminProtected(sysadminRoles, GetAdminFeatureFlags(db))...)
	protected.POST("/admin/feature-flags", adminProtected(sysadminRoles, PostAdminFeatureFlag(db))...)
	protected.PATCH("/admin/feature-flags/:id", adminProtected(sysadminRoles, PatchAdminFeatureFlag(db))...)

	// Админ: аналитика и отчёты
	protected.GET("/admin/analytics/premium-dashboard", adminProtected(billingRoles, GetAdminPremiumDashboard(db))...)
	protected.GET("/admin/analytics/chat-stats", adminProtected(sysadminRoles, GetAdminChatStats(db))...)
	protected.GET("/admin/analytics/reports-summary", adminProtected(sysadminRoles, GetAdminReportsSummary(db))...)
	protected.GET("/admin/analytics/reports-export", adminProtected(sysadminRoles, GetAdminReportsExport(db))...)
	protected.GET("/admin/analytics/audit-export", adminProtected(sysadminRoles, GetAdminAuditExport(db))...)

	// Админ: удобство (аудит, поиск, настройки)
	protected.GET("/admin/audit-log", adminProtected(sysadminRoles, GetAdminAuditLog(db))...)
	protected.GET("/admin/search", adminProtected(sysadminRoles, GetAdminGlobalSearch(db))...)
	protected.GET("/admin/me/preferences", adminProtected(allStaffRoles, GetAdminPreferences(db))...)
	protected.PATCH("/admin/me/preferences", adminProtected(allStaffRoles, PatchAdminPreferences(db))...)

	// Панель владельца (только для owner)
	protected.GET("/owner/dashboard", RequireOwner(db), GetOwnerDashboard(db))
	protected.POST("/owner/users/:id/plan", RequireOwner(db), SetUserPlan(db))
	protected.POST("/owner/users/:id/role", RequireOwner(db), SetUserRole(db))
	protected.DELETE("/owner/users/:id", RequireOwner(db), DeleteUser(db))
	protected.GET("/owner/settings", RequireOwner(db), GetSystemSettings(db))
	protected.POST("/owner/settings", RequireOwner(db), UpdateSystemSettings(db))
	protected.POST("/owner/database/clear", RequireOwner(db), ClearDatabase(db))
	protected.GET("/owner/premium/stats", RequireOwner(db), GetPremiumStats(db))
	protected.GET("/owner/revenue", RequireOwner(db), GetOwnerRevenue(db))
	protected.GET("/owner/network-topology", RequireOwner(db), GetNetworkTopology(db, wsHub))
	protected.POST("/owner/shutdown", RequireOwner(db), OwnerShutdown())
	protected.POST("/owner/restart", RequireOwner(db), OwnerRestart())
	protected.POST("/owner/send-log-report", RequireOwner(db), SendLogReportToTelegram())

	// Премиум подписка и тарифы
	protected.GET("/premium", GetPremiumInfo(db)) // Информация о премиум подписке текущего пользователя
	protected.GET("/premium/history", GetPremiumHistory(db))
	protected.POST("/premium/checkout", CheckoutPremium(db))
	protected.POST("/premium/cancel", CancelPremiumRenewal(db))
	protected.POST("/premium/resume", ResumePremiumRenewal(db))
	protected.POST("/premium/subscribe/:id", RequireOwner(db), SubscribePremium(db)) // Активировать премиум (только владелец)

	// Управление сервисами (для admin и owner)
	protected.GET("/admin/services", adminProtected(releaseRoles, GetServicesStatus(db))...)
	protected.POST("/admin/services/:id/start", adminProtected(releaseRoles, StartService(db))...)
	protected.POST("/admin/services/:id/stop", adminProtected(releaseRoles, StopService(db))...)
	protected.POST("/admin/services/:id/restart", adminProtected(releaseRoles, RestartService(db))...)

	// Персональные сообщения от администрации и Security Dashboard
	protected.POST("/admin/send-email", adminProtected(opsRoles, SendPersonalEmail(db))...)
	protected.POST("/admin/email/unread-digest", adminProtected(releaseRoles, SendUnreadDigestBatch(db))...)
	protected.POST("/admin/email/premium-expiring", adminProtected(billingRoles, SendPremiumExpiringBatch(db))...)
	protected.GET("/admin/anonymous-chat/:targetUserId", adminProtected(supportRoles, AdminGetAnonymousChat(db))...)
	protected.POST("/admin/anonymous-dm", adminProtected(supportRoles, AdminSendAnonymousDM(db, wsHub))...)
	protected.GET("/admin/security/sessions", adminProtected(riskRoles, GetAdminSecuritySessions(db))...)
	protected.GET("/admin/security/alerts", adminProtected(riskRoles, GetAdminSecurityAlerts(db))...)
	protected.GET("/admin/security/blocked-ips", adminProtected(riskRoles, GetAdminSecurityBlockedIPs(db))...)
	protected.POST("/admin/security/block-ip", adminProtected(riskRoles, PostAdminSecurityBlockIP(db))...)
	protected.POST("/admin/security/unblock-ip", adminProtected(riskRoles, PostAdminSecurityUnblockIP(db))...)
	protected.POST("/admin/broadcast-email", adminProtected(opsRoles, BroadcastPersonalEmail(db))...)

	// Технические работы
	protected.POST("/admin/maintenance", adminProtected(releaseRoles, SendMaintenanceNotificationToAll(db))...)
	protected.POST("/admin/maintenance/disable", adminProtected(releaseRoles, DisableMaintenance(db))...)

	// Обратная связь и заявки на премиум (отправка — авторизованный пользователь)
	protected.GET("/feedback", GetMyFeedback(db))
	protected.POST("/feedback", SubmitFeedback(db))

	// Webhook настройки (для admin и owner)
	protected.GET("/admin/webhook", adminProtected(sysadminRoles, GetWebhookSettings)...)
	protected.POST("/admin/webhook", adminProtected(sysadminRoles, UpdateWebhookSettings(db, cfg))...)
	protected.POST("/admin/webhook/test", adminProtected(sysadminRoles, TestWebhook)...)
	protected.GET("/admin/logs", adminProtected(safetyRoles, GetLogs)...)

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
