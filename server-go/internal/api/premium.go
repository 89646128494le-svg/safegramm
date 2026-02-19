package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetPremiumInfo возвращает информацию о премиум подписке пользователя
func GetPremiumInfo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		isPremium := user.Plan == "premium"
		
		response := gin.H{
			"isPremium": isPremium,
			"plan":      user.Plan,
			"features": []string{
				"Увеличенный лимит загрузки файлов (до 2GB)",
				"Приоритетная поддержка",
				"Расширенные настройки приватности",
				"Неограниченное количество чатов",
				"Экспорт истории чатов",
				"Улучшенные темы оформления",
				"Расширенные возможности поиска",
			},
		}

		if isPremium {
			response["badge"] = "⭐ Premium"
		}

		c.JSON(http.StatusOK, response)
	}
}

// SubscribePremium активирует премиум подписку (для владельца)
func SubscribePremium(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var req struct {
			Duration int `json:"duration"` // Длительность в днях
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
			return
		}

		if req.Duration <= 0 {
			req.Duration = 30 // По умолчанию 30 дней
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}

		user.Plan = "premium"
		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok":       true,
			"plan":     user.Plan,
			"duration": req.Duration,
		})
	}
}

// CheckPremiumFeature проверяет доступность премиум функции
func CheckPremiumFeature(db *gorm.DB, feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
			c.Abort()
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
			c.Abort()
			return
		}

		if user.Plan != "premium" {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "premium_required",
				"feature": feature,
				"message": "Эта функция доступна только для Premium пользователей",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetPremiumStats возвращает статистику премиум подписок (для владельца)
func GetPremiumStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var premiumCount int64
		var freeCount int64
		db.Model(&models.User{}).Where("plan = ?", "premium").Count(&premiumCount)
		db.Model(&models.User{}).Where("plan = ?", "free").Count(&freeCount)

		c.JSON(http.StatusOK, gin.H{
			"premium": premiumCount,
			"free":    freeCount,
			"total":   premiumCount + freeCount,
		})
	}
}

// GetPlans возвращает список тарифов для сайта (доступно без авторизации в группе protected — для единообразия).
func GetPlans(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		plans := []gin.H{
			{
				"id":          "free",
				"name":        "Бесплатный",
				"price":       0,
				"priceLabel":  "0 ₽",
				"period":      "навсегда",
				"features":    []string{"До 100 МБ загрузки файлов", "До 50 чатов", "Базовый поиск", "E2EE шифрование", "Safety AI"},
				"badge":       nil,
			},
			{
				"id":          "premium",
				"name":        "Premium",
				"price":       299,
				"priceLabel":  "299 ₽/мес",
				"period":      "месяц",
				"features":    []string{"До 2 ГБ загрузки файлов", "Неограниченное количество чатов", "Экспорт истории чатов", "Приоритетная поддержка", "Расширенные темы", "Расширенный поиск", "Все возможности Free"},
				"badge":       "⭐ Рекомендуем",
			},
		}
		c.JSON(http.StatusOK, gin.H{"plans": plans})
	}
}

