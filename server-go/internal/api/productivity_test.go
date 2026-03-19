package api

import (
	"bytes"
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
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newProductivityTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Chat{}, &models.ChatMember{}, &models.CalendarEvent{}, &models.Todo{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	return db
}

func newProductivityRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", c.GetHeader("X-Test-User"))
		c.Next()
	})
	router.GET("/api/calendar/events", GetCalendarEvents(db))
	router.POST("/api/calendar/events", CreateCalendarEvent(db))
	router.DELETE("/api/calendar/events/:id", DeleteCalendarEvent(db))
	router.GET("/api/todos", GetTodos(db))
	router.POST("/api/todos", CreateTodo(db))
	router.PATCH("/api/todos/:id", UpdateTodo(db))
	router.DELETE("/api/todos/:id", DeleteTodo(db))
	return router
}

func mustSeedUser(t *testing.T, db *gorm.DB, username string) string {
	t.Helper()
	user := models.User{
		ID:       uuid.New().String(),
		Username: username,
		PassHash: "hash",
		Status:   "online",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user.ID
}

func mustSeedChatMembership(t *testing.T, db *gorm.DB, chatID, userID string) {
	t.Helper()
	chat := models.Chat{
		ID:        chatID,
		Type:      "group",
		Name:      "Test chat",
		CreatedBy: userID,
	}
	if err := db.FirstOrCreate(&chat, models.Chat{ID: chatID}).Error; err != nil {
		t.Fatalf("seed chat: %v", err)
	}
	member := models.ChatMember{
		ID:     uuid.New().String(),
		ChatID: chatID,
		UserID: userID,
		Role:   "member",
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatalf("seed member: %v", err)
	}
}

func performJSONRequest(t *testing.T, router *gin.Engine, method, path, userID string, body any) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if userID != "" {
		req.Header.Set("X-Test-User", userID)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestCalendarEventsPersistAndRespectMembership(t *testing.T) {
	db := newProductivityTestDB(t)
	router := newProductivityRouter(db)
	ownerID := mustSeedUser(t, db, "owner")
	strangerID := mustSeedUser(t, db, "stranger")
	chatID := uuid.New().String()
	mustSeedChatMembership(t, db, chatID, ownerID)

	start := time.Now().UTC().Add(2 * time.Hour).UnixMilli()
	end := time.Now().UTC().Add(3 * time.Hour).UnixMilli()

	createResp := performJSONRequest(t, router, http.MethodPost, "/api/calendar/events", ownerID, map[string]any{
		"title":           "Созвон по релизу",
		"description":     "Сверить чеклист перед обновлением",
		"chatId":          chatID,
		"startTime":       start,
		"endTime":         end,
		"reminderMinutes": 30,
	})
	if createResp.Code != http.StatusOK {
		t.Fatalf("expected create status 200, got %d: %s", createResp.Code, createResp.Body.String())
	}

	listResp := performJSONRequest(t, router, http.MethodGet, "/api/calendar/events?chatId="+chatID, ownerID, nil)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d: %s", listResp.Code, listResp.Body.String())
	}

	var listBody struct {
		Events []calendarEventResponse `json:"events"`
	}
	if err := json.Unmarshal(listResp.Body.Bytes(), &listBody); err != nil {
		t.Fatalf("decode list body: %v", err)
	}
	if len(listBody.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(listBody.Events))
	}
	if listBody.Events[0].Title != "Созвон по релизу" {
		t.Fatalf("unexpected event title: %+v", listBody.Events[0])
	}

	deniedResp := performJSONRequest(t, router, http.MethodGet, "/api/calendar/events?chatId="+chatID, strangerID, nil)
	if deniedResp.Code != http.StatusForbidden {
		t.Fatalf("expected stranger to get 403, got %d: %s", deniedResp.Code, deniedResp.Body.String())
	}
}

func TestTodosPersistAndSupportUpdateDelete(t *testing.T) {
	db := newProductivityTestDB(t)
	router := newProductivityRouter(db)
	ownerID := mustSeedUser(t, db, "owner")
	strangerID := mustSeedUser(t, db, "stranger")

	dueDate := time.Now().UTC().Add(24 * time.Hour).UnixMilli()
	createResp := performJSONRequest(t, router, http.MethodPost, "/api/todos", ownerID, map[string]any{
		"text":     "Подготовить страницу обновления",
		"priority": "high",
		"dueDate":  dueDate,
	})
	if createResp.Code != http.StatusOK {
		t.Fatalf("expected create status 200, got %d: %s", createResp.Code, createResp.Body.String())
	}

	var createBody struct {
		Todo todoResponse `json:"todo"`
	}
	if err := json.Unmarshal(createResp.Body.Bytes(), &createBody); err != nil {
		t.Fatalf("decode create body: %v", err)
	}
	if createBody.Todo.ID == "" {
		t.Fatal("expected todo id to be returned")
	}

	updateResp := performJSONRequest(t, router, http.MethodPatch, "/api/todos/"+createBody.Todo.ID, ownerID, map[string]any{
		"completed": true,
		"text":      "Подготовить страницу статуса",
		"priority":  "low",
	})
	if updateResp.Code != http.StatusOK {
		t.Fatalf("expected update status 200, got %d: %s", updateResp.Code, updateResp.Body.String())
	}

	listResp := performJSONRequest(t, router, http.MethodGet, "/api/todos", ownerID, nil)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d: %s", listResp.Code, listResp.Body.String())
	}
	var listBody struct {
		Todos []todoResponse `json:"todos"`
	}
	if err := json.Unmarshal(listResp.Body.Bytes(), &listBody); err != nil {
		t.Fatalf("decode todos body: %v", err)
	}
	if len(listBody.Todos) != 1 {
		t.Fatalf("expected 1 todo, got %d", len(listBody.Todos))
	}
	if !listBody.Todos[0].Completed || listBody.Todos[0].Priority != "low" || listBody.Todos[0].Text != "Подготовить страницу статуса" {
		t.Fatalf("todo was not updated: %+v", listBody.Todos[0])
	}

	foreignResp := performJSONRequest(t, router, http.MethodPatch, "/api/todos/"+createBody.Todo.ID, strangerID, map[string]any{
		"completed": false,
	})
	if foreignResp.Code != http.StatusForbidden {
		t.Fatalf("expected stranger to get 403, got %d: %s", foreignResp.Code, foreignResp.Body.String())
	}

	deleteResp := performJSONRequest(t, router, http.MethodDelete, "/api/todos/"+createBody.Todo.ID, ownerID, nil)
	if deleteResp.Code != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d: %s", deleteResp.Code, deleteResp.Body.String())
	}

	listAfterDelete := performJSONRequest(t, router, http.MethodGet, "/api/todos", ownerID, nil)
	if err := json.Unmarshal(listAfterDelete.Body.Bytes(), &listBody); err != nil {
		t.Fatalf("decode todos after delete: %v", err)
	}
	if len(listBody.Todos) != 0 {
		t.Fatalf("expected empty todos after delete, got %d", len(listBody.Todos))
	}
}
