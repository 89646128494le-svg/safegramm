// Пакет alerts: отправка уведомлений владельцу (Lev) в Telegram.
package alerts

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	tgToken   string
	tgChatID  string
	tgOnce    sync.Once
	tgEnabled bool
)

func initTelegram() {
	tgToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	tgChatID = os.Getenv("TELEGRAM_CHAT_ID")
	tgEnabled = tgToken != "" && tgChatID != ""
}

// SendAdminAlert отправляет сообщение в личный Telegram владельца (Lev) через бота.
// Переменные окружения: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
func SendAdminAlert(message string) {
	tgOnce.Do(initTelegram)
	if !tgEnabled || message == "" {
		return
	}
	body := map[string]interface{}{
		"chat_id":    tgChatID,
		"text":       message,
		"parse_mode": "HTML",
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+tgToken+"/sendMessage", bytes.NewReader(raw))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}

// AlertAttack отправляет алерт об атаке и блокировке IP.
func AlertAttack(ip string, requestsPerSec int) {
	SendAdminAlert("⚠️ <b>Обнаружена атака</b>: более " + strconv.Itoa(requestsPerSec) + " запросов в секунду с IP <code>" + ip + "</code>. Я заблокировал его, Лев.")
}

// AlertPermissionAttempt отправляет алерт о попытке изменить права не-владельцем.
func AlertPermissionAttempt(adminName, targetName, action string) {
	SendAdminAlert("🔐 <b>Требуется подтверждение</b>: пользователь с ролью Admin (<code>" + adminName + "</code>) попытался выполнить: " + action + " для " + targetName + ". Требуется твоё подтверждение.")
}

// AlertServerStarted отправляет алерт о запуске сервера.
func AlertServerStarted() {
	SendAdminAlert("✅ <b>Сервер SafeGram запущен.</b> Система под защитой.")
}

// SendMonitoringReport отправляет отчёт мониторинга только тебе (Lev). Вызывается по расписанию.
func SendMonitoringReport(anomalyScore float64, logCount int, status string) {
	pct := int(anomalyScore * 100)
	msg := "📊 <b>SafeGram мониторинг</b>\n"
	msg += "Статус: " + status + "\n"
	msg += "Аномальность НС: " + strconv.Itoa(pct) + "%\n"
	msg += "Записей в логе: " + strconv.Itoa(logCount)
	if pct >= 50 {
		msg += "\n⚠️ Рекомендуется проверить логи."
	}
	SendAdminAlert(msg)
}

// ReplyToChat отправляет ответ в указанный чат (для бота).
func ReplyToChat(chatID, text string) {
	tgOnce.Do(initTelegram)
	if !tgEnabled || chatID == "" || text == "" {
		return
	}
	body := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	}
	raw, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, "https://api.telegram.org/bot"+tgToken+"/sendMessage", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}

// RunBotLoop запускает long-poll приёма команд от владельца. Отвечает только на сообщения из TELEGRAM_CHAT_ID.
// getStatus возвращает текст статуса (сервер, НС, логи); вызывается по /status и /report.
func RunBotLoop(getStatus func() string) {
	tgOnce.Do(initTelegram)
	if !tgEnabled {
		return
	}
	var offset int64
	for {
		url := "https://api.telegram.org/bot" + tgToken + "/getUpdates?timeout=30"
		if offset > 0 {
			url += "&offset=" + strconv.FormatInt(offset, 10)
		}
		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			time.Sleep(5 * time.Second)
			continue
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			time.Sleep(5 * time.Second)
			continue
		}
		var out struct {
			OK     bool `json:"ok"`
			Result []struct {
				UpdateID int64 `json:"update_id"`
				Message *struct {
					Chat struct {
						ID int64 `json:"id"`
					} `json:"chat"`
					Text string `json:"text"`
				} `json:"message"`
			} `json:"result"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&out)
		resp.Body.Close()
		if !out.OK {
			time.Sleep(5 * time.Second)
			continue
		}
		for _, u := range out.Result {
			offset = u.UpdateID + 1
			if u.Message == nil || u.Message.Text == "" {
				continue
			}
			chatIDStr := strconv.FormatInt(u.Message.Chat.ID, 10)
			if chatIDStr != tgChatID {
				continue
			}
			cmd := strings.TrimSpace(strings.ToLower(u.Message.Text))
			var reply string
			switch {
			case cmd == "/start", cmd == "/help":
				reply = "🛡️ <b>SafeGram Bot</b> (только для Lev)\n\n" +
					"/status — статус сервера и НС\n/report — полный отчёт сейчас\n/nn — оценка нейросети по логам\n/help — это сообщение"
			case cmd == "/status":
				reply = getStatus()
			case cmd == "/report":
				reply = "📊 <b>Отчёт по запросу</b>\n\n" + getStatus()
			case cmd == "/nn":
				reply = getStatus()
			default:
				reply = "Неизвестная команда. /help — список."
			}
			if reply != "" {
				ReplyToChat(chatIDStr, reply)
			}
		}
	}
}

