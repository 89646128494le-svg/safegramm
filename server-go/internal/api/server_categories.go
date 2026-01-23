package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// CreateChannelCategory создает категорию каналов (owner/admin)
func CreateChannelCategory(db *gorm.DB) gin.HandlerFunc {
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
		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			Name     string `json:"name" binding:"required"`
			Position int    `json:"position"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		cat := models.ChannelCategory{
			ID:       uuid.New().String(),
			ServerID: serverID,
			Name:     req.Name,
			Position: req.Position,
		}
		if err := db.Create(&cat).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		logModeration(db, "", serverID, userIDStr, "category_create", "", "", gin.H{"categoryId": cat.ID, "name": cat.Name})
		c.JSON(http.StatusOK, gin.H{"category": cat})
	}
}

// GetChannelCategories список категорий
func GetChannelCategories(db *gorm.DB) gin.HandlerFunc {
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

		var cats []models.ChannelCategory
		db.Where("server_id = ?", serverID).Order("position ASC").Find(&cats)
		c.JSON(http.StatusOK, gin.H{"categories": cats})
	}
}

// DeleteChannelCategory удаляет категорию (owner/admin)
func DeleteChannelCategory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		categoryID := c.Param("categoryId")
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
		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// снимаем category_id с каналов
		db.Model(&models.Channel{}).Where("server_id = ? AND category_id = ?", serverID, categoryID).Update("category_id", "")
		db.Delete(&models.ChannelCategory{}, "id = ? AND server_id = ?", categoryID, serverID)
		logModeration(db, "", serverID, userIDStr, "category_delete", "", "", gin.H{"categoryId": categoryID})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// SetChannelCategory назначает канал в категорию (owner/admin)
func SetChannelCategory(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID := c.Param("id")
		channelID := c.Param("channelId")
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
		if member.Role != "owner" && member.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			CategoryID string `json:"categoryId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		// если указана категория — проверяем что существует
		if req.CategoryID != "" {
			var cat models.ChannelCategory
			if err := db.First(&cat, "id = ? AND server_id = ?", req.CategoryID, serverID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
				return
			}
		}

		db.Model(&models.Channel{}).Where("id = ? AND server_id = ?", channelID, serverID).Update("category_id", req.CategoryID)
		logModeration(db, "", serverID, userIDStr, "channel_set_category", "", "", gin.H{"channelId": channelID, "categoryId": req.CategoryID})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

