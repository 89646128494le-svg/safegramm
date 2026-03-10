package api

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"safegram-server/internal/models"
)

// GetAdminPremiumDashboard — конверсия, отток, доход по премиуму
func GetAdminPremiumDashboard(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rangeQ := c.DefaultQuery("range", "30d")
		since := time.Now().AddDate(0, 0, -30)
		switch rangeQ {
		case "7d":
			since = time.Now().AddDate(0, 0, -7)
		case "90d":
			since = time.Now().AddDate(0, 0, -90)
		}
		var totalUsers, premiumUsers int64
		db.Model(&models.User{}).Count(&totalUsers)
		activePremiumUsersQuery(db).Count(&premiumUsers)
		conversion := 0.0
		if totalUsers > 0 {
			conversion = float64(premiumUsers) / float64(totalUsers) * 100
		}
		var revenue int64
		db.Model(&models.Payment{}).Where("status = ? AND created_at >= ?", "succeeded", since).Select("COALESCE(SUM(amount), 0)").Scan(&revenue)
		c.JSON(http.StatusOK, gin.H{
			"totalUsers":   totalUsers,
			"premiumUsers": premiumUsers,
			"conversion":   conversion,
			"churnRate":    0,
			"revenue":      revenue,
			"range":        rangeQ,
		})
	}
}

// GetAdminChatStats — самые активные чаты, группы с модерацией
func GetAdminChatStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		type row struct {
			ChatID string
			Count  int64
		}
		var rows []row
		db.Model(&models.Message{}).Select("chat_id, count(*) as count").
			Group("chat_id").Order("count DESC").Limit(50).Scan(&rows)
		out := make([]gin.H, 0, len(rows))
		for _, r := range rows {
			var ch models.Chat
			if err := db.First(&ch, "id = ?", r.ChatID).Error; err != nil {
				continue
			}
			out = append(out, gin.H{
				"chatId":       ch.ID,
				"name":         ch.Name,
				"type":         ch.Type,
				"messageCount": r.Count,
			})
		}
		var modCount int64
		db.Model(&models.ChatModerationSettings{}).Count(&modCount)
		c.JSON(http.StatusOK, gin.H{
			"activeChats":         out,
			"chatsWithModeration": modCount,
		})
	}
}

// GetAdminReportsSummary — отчёты по жалобам/модерации за период
func GetAdminReportsSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		from := c.Query("from")
		to := c.Query("to")
		var fromT, toT time.Time
		if from != "" {
			fromT, _ = time.Parse("2006-01-02", from)
		} else {
			fromT = time.Now().AddDate(0, 0, -30)
		}
		if to != "" {
			toT, _ = time.Parse("2006-01-02", to)
		} else {
			toT = time.Now()
		}
		var feedbackCount int64
		db.Model(&models.Feedback{}).Where("created_at >= ? AND created_at <= ?", fromT, toT).Count(&feedbackCount)
		var pendingMsg int64
		db.Model(&models.Message{}).Where("moderation_status = ? AND created_at >= ? AND created_at <= ?", "pending", fromT, toT).Count(&pendingMsg)
		var approvedMsg, rejectedMsg int64
		db.Model(&models.Message{}).Where("moderation_status = ? AND created_at >= ? AND created_at <= ?", "approved", fromT, toT).Count(&approvedMsg)
		db.Model(&models.Message{}).Where("moderation_status = ? AND created_at >= ? AND created_at <= ?", "rejected", fromT, toT).Count(&rejectedMsg)
		c.JSON(http.StatusOK, gin.H{
			"from":             fromT.Format("2006-01-02"),
			"to":               toT.Format("2006-01-02"),
			"feedbackCount":    feedbackCount,
			"pendingMessages":  pendingMsg,
			"approvedMessages": approvedMsg,
			"rejectedMessages": rejectedMsg,
		})
	}
}

// GetAdminReportsExport — экспорт отчётов CSV
func GetAdminReportsExport(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		from := c.Query("from")
		to := c.Query("to")
		var fromT, toT time.Time
		if from != "" {
			fromT, _ = time.Parse("2006-01-02", from)
		} else {
			fromT = time.Now().AddDate(0, 0, -30)
		}
		if to != "" {
			toT, _ = time.Parse("2006-01-02", to)
		} else {
			toT = time.Now()
		}
		var list []models.Feedback
		db.Where("created_at >= ? AND created_at <= ?", fromT, toT).Order("created_at DESC").Find(&list)
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=reports-"+fromT.Format("20060102")+"-"+toT.Format("20060102")+".csv")
		w := csv.NewWriter(c.Writer)
		_ = w.Write([]string{"id", "userId", "subject", "body", "createdAt"})
		for _, r := range list {
			_ = w.Write([]string{r.ID, r.UserID, r.Subject, r.Body, r.CreatedAt.Format(time.RFC3339)})
		}
		w.Flush()
	}
}

// GetAdminAuditExport — экспорт аудит-лога CSV
func GetAdminAuditExport(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "1000"))
		if limit > 5000 {
			limit = 5000
		}
		var list []models.AdminAuditLog
		db.Order("created_at DESC").Limit(limit).Find(&list)
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=audit-log.csv")
		w := csv.NewWriter(c.Writer)
		_ = w.Write([]string{"id", "adminId", "targetId", "action", "details", "ip", "createdAt"})
		for _, e := range list {
			_ = w.Write([]string{e.ID, e.AdminID, e.TargetID, e.Action, e.Details, e.IP, e.CreatedAt.Format(time.RFC3339)})
		}
		w.Flush()
	}
}
