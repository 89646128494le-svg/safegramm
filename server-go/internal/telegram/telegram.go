package telegram

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"sync"
)

var (
	token   string
	chatID  string
	once    sync.Once
	enabled bool
)

func initBot() {
	token = os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID = os.Getenv("TELEGRAM_CHAT_ID")
	enabled = token != "" && chatID != ""
}

// Send отправляет сообщение владельцу (Lev) в Telegram. TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
func Send(text string) bool {
	once.Do(initBot)
	if !enabled || text == "" {
		return false
	}
	body := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", bytes.NewReader(raw))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// Enabled возвращает true, если бот настроен.
func Enabled() bool {
	once.Do(initBot)
	return enabled
}
