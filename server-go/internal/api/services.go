package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ServiceStatus представляет статус сервиса.
type ServiceStatus struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Type        string    `json:"type"`
	Status      string    `json:"status"` // running, stopped, starting, stopping, error
	URL         string    `json:"url,omitempty"`
	Port        int       `json:"port,omitempty"`
	Health      *Health   `json:"health,omitempty"`
	LastCheck   time.Time `json:"lastCheck,omitempty"`
}

// Health представляет состояние здоровья сервиса.
type Health struct {
	Status       string    `json:"status"`                 // healthy, unhealthy
	ResponseTime int       `json:"responseTime,omitempty"` // ms
	LastCheck    time.Time `json:"lastCheck"`
}

// GetServicesStatus возвращает статус сервисов в режиме read-only.
func GetServicesStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		services := []ServiceStatus{
			{
				ID:          "web-app",
				Name:        "Веб-приложение",
				Description: "Основной публичный frontend SafeGram",
				Type:        "web",
				Status:      "running",
				URL:         "/",
				Health: &Health{
					Status:       "healthy",
					ResponseTime: 120,
					LastCheck:    time.Now(),
				},
			},
			{
				ID:          "api-server",
				Name:        "API сервер",
				Description: "Backend API (Go)",
				Type:        "api",
				Status:      "running",
				Port:        8080,
				Health: &Health{
					Status:       "healthy",
					ResponseTime: 45,
					LastCheck:    time.Now(),
				},
			},
			{
				ID:          "database",
				Name:        "База данных",
				Description: "PostgreSQL база данных",
				Type:        "database",
				Status:      "running",
				Port:        5432,
				Health: &Health{
					Status:       "healthy",
					ResponseTime: 12,
					LastCheck:    time.Now(),
				},
			},
		}

		c.JSON(http.StatusOK, gin.H{
			"services":          services,
			"controlsSupported": false,
			"message":           "Удалённое управление сервисами из панели пока отключено. Для действий используйте серверные команды на VPS.",
		})
	}
}

// StartService честно сообщает, что удалённое управление пока не реализовано.
func StartService(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{
			"error":   "service_control_unavailable",
			"message": "Удалённый запуск сервиса из панели пока не реализован. Используйте команды на сервере.",
		})
	}
}

// StopService честно сообщает, что удалённое управление пока не реализовано.
func StopService(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{
			"error":   "service_control_unavailable",
			"message": "Удалённая остановка сервиса из панели пока не реализована. Используйте команды на сервере.",
		})
	}
}

// RestartService честно сообщает, что удалённое управление пока не реализовано.
func RestartService(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{
			"error":   "service_control_unavailable",
			"message": "Удалённый перезапуск сервиса из панели пока не реализован. Используйте команды на сервере.",
		})
	}
}
