package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"safegram-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type publicStatusSummaryResponse struct {
	Status      string `json:"status"`
	GeneratedAt string `json:"generatedAt"`
	API         struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	} `json:"api"`
	Maintenance struct {
		IsActive bool   `json:"isActive"`
		Enabled  bool   `json:"enabled"`
		ID       string `json:"id"`
		Message  string `json:"message"`
	} `json:"maintenance"`
	SystemBanner struct {
		IsActive bool   `json:"isActive"`
		Enabled  bool   `json:"enabled"`
		ID       string `json:"id"`
		Title    string `json:"title"`
		Severity string `json:"severity"`
	} `json:"systemBanner"`
}

func newPublicStatusTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.MaintenanceMode{}, &models.SystemBanner{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	return db
}

func performPublicStatusRequest(t *testing.T, db *gorm.DB) publicStatusSummaryResponse {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/status/summary", GetPublicStatusSummary(db))

	req := httptest.NewRequest(http.MethodGet, "/api/status/summary", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d with body %s", w.Code, w.Body.String())
	}

	var response publicStatusSummaryResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode json: %v", err)
	}
	return response
}

func TestGetPublicStatusSummaryOperational(t *testing.T) {
	db := newPublicStatusTestDB(t)
	response := performPublicStatusRequest(t, db)

	if response.Status != "operational" {
		t.Fatalf("expected operational status, got %q", response.Status)
	}
	if !response.API.OK {
		t.Fatalf("expected api.ok=true, got false with error %q", response.API.Error)
	}
	if response.Maintenance.IsActive || response.Maintenance.Enabled {
		t.Fatalf("expected maintenance to be disabled, got %+v", response.Maintenance)
	}
	if response.SystemBanner.IsActive || response.SystemBanner.Enabled {
		t.Fatalf("expected system banner to be disabled, got %+v", response.SystemBanner)
	}
	if response.GeneratedAt == "" {
		t.Fatal("expected generatedAt to be populated")
	}
}

func TestGetPublicStatusSummaryMaintenanceTakesPriority(t *testing.T) {
	db := newPublicStatusTestDB(t)
	now := time.Now().UTC()

	if err := db.Create(&models.MaintenanceMode{
		ID:        "maintenance-1",
		IsActive:  true,
		Message:   "Проводим обновление сервиса",
		Timestamp: now.Format(time.RFC3339),
	}).Error; err != nil {
		t.Fatalf("create maintenance: %v", err)
	}

	if err := db.Create(&models.SystemBanner{
		ID:          "banner-1",
		IsActive:    true,
		Title:       "Важно",
		Message:     "Есть временные ограничения",
		Severity:    "critical",
		Dismissible: true,
	}).Error; err != nil {
		t.Fatalf("create banner: %v", err)
	}

	response := performPublicStatusRequest(t, db)

	if response.Status != "maintenance" {
		t.Fatalf("expected maintenance status, got %q", response.Status)
	}
	if response.Maintenance.ID != "maintenance-1" || !response.Maintenance.IsActive {
		t.Fatalf("expected active maintenance payload, got %+v", response.Maintenance)
	}
	if response.SystemBanner.ID != "banner-1" || !response.SystemBanner.IsActive {
		t.Fatalf("expected live system banner payload, got %+v", response.SystemBanner)
	}
}

func TestGetPublicStatusSummaryReturnsDegradedStateWhenDBPingFails(t *testing.T) {
	db := newPublicStatusTestDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db handle: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close db: %v", err)
	}

	response := performPublicStatusRequest(t, db)

	if response.Status != "degraded" {
		t.Fatalf("expected degraded status, got %q", response.Status)
	}
	if response.API.OK {
		t.Fatal("expected api.ok=false for degraded status")
	}
	if response.API.Error != "db_ping" {
		t.Fatalf("expected db_ping error, got %q", response.API.Error)
	}
}
