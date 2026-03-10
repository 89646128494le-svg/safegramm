package api

import (
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

const (
	LobbySystemUserID  = "00000000-0000-0000-0000-000000000002"
	LobbySystemName    = "SafeGram"
	LobbyServerName    = "SafeGram Lobby"
	LobbyServerInvite  = "safegram-lobby"
	lobbyWelcomePrompt = "Добро пожаловать в SafeGram Lobby.\n\n1. Представьтесь в #general\n2. Загляните в #знакомства\n3. Если нужна помощь, напишите в #помощь\n4. Хотите поговорить голосом — заходите в канал «Общий»"
)

type LobbyBootstrapResult struct {
	ServerID            string
	EntryTextChannelID  string
	EntryVoiceChannelID string
}

type lobbyChannelSpec struct {
	Name     string
	Type     string
	Position int
}

var defaultLobbyChannels = []lobbyChannelSpec{
	{Name: "general", Type: "text", Position: 0},
	{Name: "знакомства", Type: "text", Position: 1},
	{Name: "помощь", Type: "text", Position: 2},
	{Name: "Общий", Type: "voice", Position: 0},
	{Name: "Быстрый созвон", Type: "voice", Position: 1},
}

func EnsureCommunityLobbyForUser(db *gorm.DB, userID, username string) (*LobbyBootstrapResult, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, nil
	}

	result := &LobbyBootstrapResult{}
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := ensureLobbySystemUser(tx); err != nil {
			return err
		}

		server, err := ensureLobbyServer(tx)
		if err != nil {
			return err
		}
		result.ServerID = server.ID

		channels, err := ensureLobbyChannels(tx, server.ID)
		if err != nil {
			return err
		}

		joined, err := ensureLobbyServerMember(tx, server.ID, userID)
		if err != nil {
			return err
		}

		var generalTextChatID string
		for _, channel := range channels {
			if err := ensureLobbyChatMember(tx, channel.ChatID, userID); err != nil {
				return err
			}
			switch {
			case channel.Type == "text" && strings.EqualFold(channel.Name, "general"):
				result.EntryTextChannelID = channel.ID
				generalTextChatID = channel.ChatID
			case channel.Type == "voice" && strings.EqualFold(channel.Name, "общий"):
				result.EntryVoiceChannelID = channel.ID
			}
		}

		if generalTextChatID != "" {
			if err := ensureLobbyWelcomeMessage(tx, generalTextChatID); err != nil {
				return err
			}
			if joined {
				displayName := strings.TrimSpace(username)
				if displayName == "" {
					displayName = "Новый участник"
				}
				if err := postLobbySystemMessage(tx, generalTextChatID, displayName+" присоединился к SafeGram Lobby. Поздоровайтесь в чате или заходите в голосовой «Общий»."); err != nil {
					return err
				}
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func ensureLobbySystemUser(db *gorm.DB) error {
	var user models.User
	err := db.First(&user, "id = ?", LobbySystemUserID).Error
	if err == nil {
		updates := map[string]any{}
		if user.Username != LobbySystemName {
			updates["username"] = LobbySystemName
		}
		if user.Roles != "[]" {
			updates["roles"] = "[]"
		}
		if len(updates) > 0 {
			return db.Model(&models.User{}).Where("id = ?", LobbySystemUserID).Updates(updates).Error
		}
		return nil
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}

	user = models.User{
		ID:           LobbySystemUserID,
		Username:     LobbySystemName,
		PassHash:     "system",
		Salt:         "system",
		Roles:        "[]",
		Plan:         "free",
		Status:       "online",
		ProfileColor: "#4f7cff",
		ShowBio:      false,
		ShowAvatar:   true,
	}
	return db.Create(&user).Error
}

func ensureLobbyServer(db *gorm.DB) (*models.Server, error) {
	var server models.Server
	err := db.Where("invite_link = ?", LobbyServerInvite).First(&server).Error
	if err == nil {
		updates := map[string]any{}
		if server.Name != LobbyServerName {
			updates["name"] = LobbyServerName
		}
		if strings.TrimSpace(server.Description) == "" {
			updates["description"] = "Главный сервер SafeGram для знакомства, общения и быстрых голосовых созвонов."
		}
		if server.OwnerID != LobbySystemUserID {
			updates["owner_id"] = LobbySystemUserID
		}
		if len(updates) > 0 {
			if err := db.Model(&models.Server{}).Where("id = ?", server.ID).Updates(updates).Error; err != nil {
				return nil, err
			}
			if name, ok := updates["name"].(string); ok {
				server.Name = name
			}
			if description, ok := updates["description"].(string); ok {
				server.Description = description
			}
			if ownerID, ok := updates["owner_id"].(string); ok {
				server.OwnerID = ownerID
			}
		}
		if err := ensureLobbyOwnerMembership(db, server.ID); err != nil {
			return nil, err
		}
		return &server, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	server = models.Server{
		ID:          uuid.New().String(),
		Name:        LobbyServerName,
		Description: "Главный сервер SafeGram для знакомства, общения и быстрых голосовых созвонов.",
		OwnerID:     LobbySystemUserID,
		InviteLink:  LobbyServerInvite,
	}
	if err := db.Create(&server).Error; err != nil {
		return nil, err
	}
	if err := ensureLobbyOwnerMembership(db, server.ID); err != nil {
		return nil, err
	}
	return &server, nil
}

func ensureLobbyOwnerMembership(db *gorm.DB, serverID string) error {
	var member models.ServerMember
	err := db.Where("server_id = ? AND user_id = ?", serverID, LobbySystemUserID).First(&member).Error
	if err == nil {
		if member.Role != "owner" {
			return db.Model(&models.ServerMember{}).Where("id = ?", member.ID).Update("role", "owner").Error
		}
		return nil
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	return db.Create(&models.ServerMember{
		ID:       uuid.New().String(),
		ServerID: serverID,
		UserID:   LobbySystemUserID,
		Role:     "owner",
	}).Error
}

func ensureLobbyChannels(db *gorm.DB, serverID string) ([]models.Channel, error) {
	out := make([]models.Channel, 0, len(defaultLobbyChannels))
	for _, spec := range defaultLobbyChannels {
		channel, err := ensureLobbyChannel(db, serverID, spec)
		if err != nil {
			return nil, err
		}
		out = append(out, *channel)
	}
	return out, nil
}

func ensureLobbyChannel(db *gorm.DB, serverID string, spec lobbyChannelSpec) (*models.Channel, error) {
	var channel models.Channel
	err := db.Where("server_id = ? AND name = ? AND type = ?", serverID, spec.Name, spec.Type).First(&channel).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	if err == gorm.ErrRecordNotFound {
		chat := models.Chat{
			ID:         uuid.New().String(),
			Type:       "channel",
			Name:       spec.Name,
			CreatedBy:  LobbySystemUserID,
			InviteLink: "ch:" + uuid.New().String(),
		}
		if err := db.Create(&chat).Error; err != nil {
			return nil, err
		}
		if err := db.Create(&models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: chat.ID,
			UserID: LobbySystemUserID,
			Role:   "owner",
		}).Error; err != nil {
			return nil, err
		}
		channel = models.Channel{
			ID:       uuid.New().String(),
			ServerID: serverID,
			ChatID:   chat.ID,
			Name:     spec.Name,
			Type:     spec.Type,
			Position: spec.Position,
		}
		if err := db.Create(&channel).Error; err != nil {
			return nil, err
		}
		return &channel, nil
	}

	updates := map[string]any{}
	if channel.Position != spec.Position {
		updates["position"] = spec.Position
	}
	if channel.ChatID == "" {
		chat := models.Chat{
			ID:         uuid.New().String(),
			Type:       "channel",
			Name:       spec.Name,
			CreatedBy:  LobbySystemUserID,
			InviteLink: "ch:" + uuid.New().String(),
		}
		if err := db.Create(&chat).Error; err != nil {
			return nil, err
		}
		if err := db.Create(&models.ChatMember{
			ID:     uuid.New().String(),
			ChatID: chat.ID,
			UserID: LobbySystemUserID,
			Role:   "owner",
		}).Error; err != nil {
			return nil, err
		}
		updates["chat_id"] = chat.ID
		channel.ChatID = chat.ID
	}
	if len(updates) > 0 {
		if err := db.Model(&models.Channel{}).Where("id = ?", channel.ID).Updates(updates).Error; err != nil {
			return nil, err
		}
		if position, ok := updates["position"].(int); ok {
			channel.Position = position
		}
	}

	var chat models.Chat
	if err := db.First(&chat, "id = ?", channel.ChatID).Error; err == nil {
		chatUpdates := map[string]any{}
		if chat.Name != spec.Name {
			chatUpdates["name"] = spec.Name
		}
		if len(chatUpdates) > 0 {
			if err := db.Model(&models.Chat{}).Where("id = ?", chat.ID).Updates(chatUpdates).Error; err != nil {
				return nil, err
			}
		}
	}

	if err := ensureLobbyChatMember(db, channel.ChatID, LobbySystemUserID); err != nil {
		return nil, err
	}
	return &channel, nil
}

func ensureLobbyServerMember(db *gorm.DB, serverID, userID string) (bool, error) {
	var member models.ServerMember
	err := db.Where("server_id = ? AND user_id = ?", serverID, userID).First(&member).Error
	if err == nil {
		return false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return false, err
	}
	return true, db.Create(&models.ServerMember{
		ID:       uuid.New().String(),
		ServerID: serverID,
		UserID:   userID,
		Role:     "member",
	}).Error
}

func ensureLobbyChatMember(db *gorm.DB, chatID, userID string) error {
	if strings.TrimSpace(chatID) == "" || strings.TrimSpace(userID) == "" {
		return nil
	}
	var member models.ChatMember
	err := db.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member).Error
	if err == nil {
		return nil
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	return db.Create(&models.ChatMember{
		ID:     uuid.New().String(),
		ChatID: chatID,
		UserID: userID,
		Role:   "member",
	}).Error
}

func ensureLobbyWelcomeMessage(db *gorm.DB, chatID string) error {
	var count int64
	if err := db.Model(&models.Message{}).Where("chat_id = ?", chatID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return postLobbySystemMessage(db, chatID, lobbyWelcomePrompt)
}

func postLobbySystemMessage(db *gorm.DB, chatID, text string) error {
	if strings.TrimSpace(chatID) == "" || strings.TrimSpace(text) == "" {
		return nil
	}
	msg := models.Message{
		ID:               uuid.New().String(),
		ChatID:           chatID,
		SenderID:         LobbySystemUserID,
		Text:             text,
		ModerationStatus: "approved",
	}
	return db.Create(&msg).Error
}
