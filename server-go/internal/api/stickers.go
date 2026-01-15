package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetStickerPacks возвращает список стикер-паков
func GetStickerPacks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var packs []models.StickerPack
		if err := db.Preload("Stickers").Find(&packs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"packs": packs})
	}
}

// GetStickers возвращает стикеры из пака
func GetStickers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		packID := c.Param("packId")
		var stickers []models.Sticker
		if err := db.Where("pack_id = ?", packID).Find(&stickers).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"stickers": stickers})
	}
}

