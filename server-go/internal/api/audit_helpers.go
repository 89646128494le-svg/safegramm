package api

import (
	"encoding/json"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

func logMemberEvent(db *gorm.DB, scopeType, scopeID, userID, actorID, action string, details any) {
	var detailsStr string
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			detailsStr = string(b)
		}
	}
	ev := models.MemberEvent{
		ID:        uuid.New().String(),
		ScopeType: scopeType,
		ScopeID:   scopeID,
		UserID:    userID,
		ActorID:   actorID,
		Action:    action,
		Details:   detailsStr,
	}
	_ = db.Create(&ev).Error
}

func logModeration(db *gorm.DB, chatID, serverID, actorID, action, targetUserID, targetMessageID string, metadata any) {
	var metaStr string
	if metadata != nil {
		if b, err := json.Marshal(metadata); err == nil {
			metaStr = string(b)
		}
	}
	l := models.ModerationLog{
		ID:              uuid.New().String(),
		ChatID:          chatID,
		ServerID:        serverID,
		ActorID:         actorID,
		Action:          action,
		TargetUserID:    targetUserID,
		TargetMessageID: targetMessageID,
		Metadata:        metaStr,
	}
	_ = db.Create(&l).Error
}

