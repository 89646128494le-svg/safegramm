package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// Права как в Discord (битовые флаги или список; используем список строк для простоты).
var allServerPermissions = []string{
	"manage_server", "manage_roles", "manage_channels", "manage_invites",
	"kick_members", "ban_members", "change_nickname", "manage_nicknames",
	"send_messages", "manage_messages", "embed_links", "attach_files",
	"read_history", "mention_everyone", "voice_connect", "voice_speak", "voice_mute_members",
}

func serverRequireOwnerOrAdmin(db *gorm.DB) func(*gin.Context, string, string) bool {
	return func(c *gin.Context, serverID, userIDStr string) bool {
		var m models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&m).Error; err != nil {
			return false
		}
		return m.Role == "owner" || m.Role == "admin"
	}
}

// GetServerRoles возвращает все роли сервера
func GetServerRoles(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var roles []models.ServerRole
		db.Where("server_id = ?", serverID).Order("position DESC").Find(&roles)

		out := make([]gin.H, len(roles))
		for i, r := range roles {
			var perms []string
			if r.Permissions != "" {
				_ = json.Unmarshal([]byte(r.Permissions), &perms)
			}
			out[i] = gin.H{
				"id":          r.ID,
				"serverId":    r.ServerID,
				"name":        r.Name,
				"color":       r.Color,
				"position":    r.Position,
				"permissions": perms,
				"createdAt":   r.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, gin.H{"roles": out, "allPermissions": allServerPermissions})
	}
}

// CreateServerRole создаёт роль (owner/admin)
func CreateServerRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		require := serverRequireOwnerOrAdmin(db)
		if !require(c, serverID, userIDStr) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			Name        string   `json:"name" binding:"required,min=1,max=100"`
			Color       string   `json:"color"`
			Permissions []string `json:"permissions"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		color := strings.TrimPrefix(strings.TrimSpace(req.Color), "#")
		if len(color) != 6 {
			color = "99aab5"
		}

		var maxPos int
		db.Model(&models.ServerRole{}).Where("server_id = ?", serverID).Select("COALESCE(MAX(position), 0)").Scan(&maxPos)

		permJSON, _ := json.Marshal(req.Permissions)

		role := models.ServerRole{
			ID:          uuid.New().String(),
			ServerID:    serverID,
			Name:        strings.TrimSpace(req.Name),
			Color:       color,
			Position:    maxPos + 1,
			Permissions: string(permJSON),
		}
		if err := db.Create(&role).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var perms []string
		_ = json.Unmarshal([]byte(role.Permissions), &perms)
		c.JSON(http.StatusOK, gin.H{"role": gin.H{
			"id":          role.ID,
			"serverId":    role.ServerID,
			"name":        role.Name,
			"color":       role.Color,
			"position":    role.Position,
			"permissions": perms,
			"createdAt":   role.CreatedAt,
		}})
	}
}

// UpdateServerRole обновляет роль
func UpdateServerRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		roleID := c.Param("roleId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		require := serverRequireOwnerOrAdmin(db)
		if !require(c, serverID, userIDStr) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var role models.ServerRole
		if err := db.Where("id = ? AND server_id = ?", roleID, serverID).First(&role).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		var req struct {
			Name        *string  `json:"name"`
			Color       *string  `json:"color"`
			Position    *int     `json:"position"`
			Permissions []string `json:"permissions"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if req.Name != nil && len(*req.Name) > 0 {
			role.Name = strings.TrimSpace(*req.Name)
		}
		if req.Color != nil {
			role.Color = strings.TrimPrefix(strings.TrimSpace(*req.Color), "#")
			if len(role.Color) != 6 {
				role.Color = "99aab5"
			}
		}
		if req.Position != nil {
			role.Position = *req.Position
		}
		if req.Permissions != nil {
			permJSON, _ := json.Marshal(req.Permissions)
			role.Permissions = string(permJSON)
		}
		db.Save(&role)

		var perms []string
		_ = json.Unmarshal([]byte(role.Permissions), &perms)
		c.JSON(http.StatusOK, gin.H{"role": gin.H{
			"id":          role.ID,
			"serverId":    role.ServerID,
			"name":        role.Name,
			"color":       role.Color,
			"position":    role.Position,
			"permissions": perms,
			"createdAt":   role.CreatedAt,
		}})
	}
}

// DeleteServerRole удаляет роль
func DeleteServerRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		roleID := c.Param("roleId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		require := serverRequireOwnerOrAdmin(db)
		if !require(c, serverID, userIDStr) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		db.Where("server_id = ? AND role_id = ?", serverID, roleID).Delete(&models.ServerMemberRole{})
		res := db.Where("id = ? AND server_id = ?", roleID, serverID).Delete(&models.ServerRole{})
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// GetServerMemberRoles возвращает роли участника
func GetServerMemberRoles(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		memberUserID := c.Param("userId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var member models.ServerMember
		if err := db.Where("server_id = ? AND user_id = ?", serverID, userIDStr).First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var roleIDs []string
		db.Model(&models.ServerMemberRole{}).Where("server_id = ? AND user_id = ?", serverID, memberUserID).Pluck("role_id", &roleIDs)

		var roles []models.ServerRole
		if len(roleIDs) > 0 {
			db.Where("id IN ?", roleIDs).Find(&roles)
		}

		out := make([]gin.H, len(roles))
		for i, r := range roles {
			var perms []string
			if r.Permissions != "" {
				_ = json.Unmarshal([]byte(r.Permissions), &perms)
			}
			out[i] = gin.H{"id": r.ID, "name": r.Name, "color": r.Color, "position": r.Position, "permissions": perms}
		}
		c.JSON(http.StatusOK, gin.H{"roles": out})
	}
}

// SetServerMemberRoles назначает роли участнику (owner/admin)
func SetServerMemberRoles(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		memberUserID := c.Param("userId")
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		require := serverRequireOwnerOrAdmin(db)
		if !require(c, serverID, userIDStr) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			RoleIDs []string `json:"roleIds"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		db.Where("server_id = ? AND user_id = ?", serverID, memberUserID).Delete(&models.ServerMemberRole{})

		for _, roleID := range req.RoleIDs {
			if roleID == "" {
				continue
			}
			var r models.ServerRole
			if err := db.Where("id = ? AND server_id = ?", roleID, serverID).First(&r).Error; err != nil {
				continue
			}
			db.Create(&models.ServerMemberRole{ServerID: serverID, UserID: memberUserID, RoleID: roleID})
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
