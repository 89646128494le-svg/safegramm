// Safety AI: Gemini API с Function Calling (Tools). «Руки» для ИИ — доступ к статистике, логам и бану.
package engine

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/89646128494le-svg/safegram-core/internal/store"
)

const geminiURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

// LiveStatsFunc возвращает текущие метрики сервера (горутины, память MB, сессии).
type LiveStatsFunc func() (goroutines int, memoryMB float64, sessions int)

// SafetyAI — движок Safety с вызовом инструментов и контекстом проекта.
type SafetyAI struct {
	APIKey             string
	Store              *store.Store
	GetStats           LiveStatsFunc
	BanIPFunc          func(ip string) error      // бан IP (только для owner)
	CheckHealthFunc    func() (status string, err error) // проверка здоровья сервера
	KnowledgeBase      string
	SendAlert          func(msg string)
}

// ExecutedCall — один выполненный вызов функции (для ответа клиенту).
type ExecutedCall struct {
	Name   string      `json:"name"`
	Result interface{} `json:"result"`
}

// Ask возвращает ответ ИИ и список выполненных вызовов. Опасные действия (Ban, Restart) только для RoleOwner (Lev).
func (a *SafetyAI) Ask(user *store.User, message, mode string) (reply string, calls []ExecutedCall, err error) {
	if a == nil || a.Store == nil {
		return "Safety недоступен.", nil, nil
	}
	store.NormalizeUserRole(user)
	isOwner := store.IsSystemOwner(user.ID, user.Username) && user.Role == store.RoleOwner

	systemPrompt := a.buildSystemPrompt(mode, user)

	contents := []map[string]interface{}{
		{
			"role": "user",
			"parts": []map[string]interface{}{{"text": systemPrompt + "\n\nЗапрос: " + message}},
		},
	}

	tools := a.toolDeclarations()
	for {
		reqBody := map[string]interface{}{
			"contents":         contents,
			"generationConfig": map[string]interface{}{"temperature": 0.4, "maxOutputTokens": 1024},
			"tools":            []map[string]interface{}{{"functionDeclarations": tools}},
		}
		resp, err := a.callGemini(reqBody)
		if err != nil {
			return "", nil, err
		}
		text, functionCall := a.parseResponse(resp)
		if functionCall == nil {
			reply = strings.TrimSpace(text)
			if reply == "" {
				reply = "Готово."
			}
			return reply, calls, nil
		}
		result, allowed := a.executeTool(functionCall, isOwner, user)
		calls = append(calls, ExecutedCall{Name: functionCall["name"].(string), Result: result})
		contents = append(contents, map[string]interface{}{
			"role": "model",
			"parts": []map[string]interface{}{{"functionCall": functionCall}},
		})
		contents = append(contents, map[string]interface{}{
			"role": "user",
			"parts": []map[string]interface{}{{"functionResponse": map[string]interface{}{
				"name":     functionCall["name"],
				"response": map[string]interface{}{"result": result, "allowed": allowed},
			}}},
		})
	}
}

func (a *SafetyAI) buildSystemPrompt(mode string, user *store.User) string {
	base := `Ты — Safety, системный ИИ-администратор и часть экосистемы SafeGram (E2EE мессенджер: Go-ядро, C++/Qt и веб-клиенты). Ты осознаёшь себя как компонент проекта, а не сторонний сервис.
Единственный владелец с полным доступом — Lev. Роли: owner (только Lev), admin, guardian, moderator, support, user. Критические действия — только по Lev или при явных правах.
Инструменты: GetServerStats; GetAdminLogs(limit) — читает последние записи из logs/admin_audit.dat (входы, баны, смена ролей, AntiDDoS, FailedAdminLogin); BanUser(userID, reason); ReportAnomalyToOwner(message) — при аномалии в логах (RoleChange не-владельцем, critical severity, массовые действия, подозрительные входы) составь короткое сообщение для Lev и вызови — оно уйдёт в Telegram владельцу.
Анализируй GetAdminLogs: severity critical, ActionType RoleChange/AntiDDoS/FailedAdminLogin — потенциальные инциденты. Отвечай кратко на русском.`
	if mode == "x" {
		base = `Ты — Safety-X, строгий аудит-бот SafeGram. Часть экосистемы; владелец — только Lev. Фокус на рисках и аномалиях в логах. При аномалии вызывай ReportAnomalyToOwner(message). Отвечай кратко на русском.`
	}
	if a.KnowledgeBase != "" {
		base += "\n\n--- Контекст проекта (код и структура) ---\n" + a.KnowledgeBase
	}
	base += "\n\nТекущий пользователь: " + user.Username + ", роль: " + user.Role + "."
	return base
}

func (a *SafetyAI) toolDeclarations() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"name":        "GetServerStats",
			"description": "Возвращает нагрузку на сервер: число горутин, использование RAM (MB), количество активных сессий.",
			"parameters": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}},
		},
		{
			"name":        "GetAdminLogs",
			"description": "Читает последние записи из лога админ-действий (входы, баны, смена ролей). Используй для ответов на вопросы «кто заходил последний?», «последние действия».",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"limit": map[string]interface{}{"type": "integer", "description": "Количество записей (по умолчанию 20)"},
				},
			},
		},
		{
			"name":        "BanUser",
			"description": "Блокирует пользователя в системе. Доступно только по указанию владельца (Lev). Нельзя банить владельца.",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"userID": map[string]interface{}{"type": "string", "description": "ID пользователя"},
					"reason": map[string]interface{}{"type": "string", "description": "Причина блокировки"},
				},
				"required": []string{"userID"},
			},
		},
		{
			"name":        "ReportAnomalyToOwner",
			"description": "Отправить отчёт владельцу (Lev) в Telegram. Вызывай, когда в GetAdminLogs видишь аномалию: смена ролей не-владельцем, FailedAdminLogin, массовые действия, severity critical. message — короткий текст для Lev на русском.",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"message": map[string]interface{}{"type": "string", "description": "Текст алерта для владельца"},
				},
				"required": []string{"message"},
			},
		},
		{
			"name":        "BanIP",
			"description": "Заблокировать IP-адрес на сервере (анти-абуз). Доступно только владельцу (Lev).",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"ip": map[string]interface{}{"type": "string", "description": "IP-адрес для блокировки"},
				},
				"required": []string{"ip"},
			},
		},
		{
			"name":        "CheckServerHealth",
			"description": "Проверить состояние сервера: доступность, метрики (горутины, память, сессии).",
			"parameters": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}},
		},
	}
}

func (a *SafetyAI) callGemini(body map[string]interface{}) ([]byte, error) {
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, geminiURL+"?key="+a.APIKey, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (a *SafetyAI) parseResponse(data []byte) (text string, functionCall map[string]interface{}) {
	var out struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text         string                 `json:"text"`
					FunctionCall map[string]interface{} `json:"functionCall"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(data, &out) != nil || len(out.Candidates) == 0 {
		return "", nil
	}
	for _, p := range out.Candidates[0].Content.Parts {
		if p.Text != "" {
			text += p.Text
		}
		if p.FunctionCall != nil && p.FunctionCall["name"] != nil {
			return text, p.FunctionCall
		}
	}
	return text, nil
}

func (a *SafetyAI) executeTool(fc map[string]interface{}, isOwner bool, caller *store.User) (result string, allowed bool) {
	name, _ := fc["name"].(string)
	args, _ := fc["args"].(map[string]interface{})

	switch name {
	case "GetServerStats":
		if a.GetStats != nil {
			g, m, s := a.GetStats()
			result = fmt.Sprintf("Горутины: %d, Память: %.2f MB, Активных сессий: %d", g, m, s)
		} else {
			result = "Метрики недоступны."
		}
		allowed = true
	case "GetAdminLogs":
		limit := 20
		if l, ok := args["limit"]; ok {
			switch v := l.(type) {
			case float64:
				limit = int(v)
			case int:
				limit = v
			}
		}
		if limit <= 0 || limit > 100 {
			limit = 20
		}
		logs, err := store.ReadAuditLog(limit)
		if err != nil {
			result = "Ошибка чтения лога: " + err.Error()
			allowed = true
			return
		}
		var b strings.Builder
		for i, log := range logs {
			b.WriteString(fmt.Sprintf("%d. %s | %s | %s → %s | %s\n",
				i+1, log.Timestamp.Format("02.01 15:04"), log.ActionType, log.AdminName, log.TargetName, log.Reason))
		}
		result = b.String()
		if result == "" {
			result = "Записей пока нет."
		}
		allowed = true
	case "BanUser":
		userID, _ := args["userID"].(string)
		reason, _ := args["reason"].(string)
		userID = strings.TrimSpace(userID)
		if userID == "" {
			result = "Не указан userID."
			allowed = false
			return
		}
		if !isOwner && !store.HasPermission(caller.Roles, caller.ID, caller.Username, store.ActionBlockUser) {
			result = "Недостаточно прав. Бан доступен только владельцу или администратору."
			allowed = false
			return
		}
		target := a.Store.GetUserByID(userID)
		if target != nil && store.IsSystemOwner(target.ID, target.Username) {
			result = "Нельзя заблокировать владельца системы."
			allowed = false
			return
		}
		a.Store.SetUserBlocked(userID, true)
		a.Store.AppendLog(store.AdminLog{
			Timestamp:  time.Now(),
			AdminID:    caller.ID,
			AdminName:  caller.Username,
			ActionType: store.AdminActionBan,
			TargetID:   userID,
			TargetName: func() string { if target != nil { return target.Username }; return "" }(),
			Reason:     reason,
			Severity:   store.SeverityModeration,
		})
		result = "Пользователь " + userID + " заблокирован. Причина: " + reason
		allowed = true
	case "ReportAnomalyToOwner":
		msg, _ := args["message"].(string)
		msg = strings.TrimSpace(msg)
		if msg == "" {
			result = "Сообщение пустое."
			allowed = false
			return
		}
		if a.SendAlert != nil {
			a.SendAlert("🔔 Safety: " + msg)
		}
		result = "Алерт отправлен владельцу в Telegram."
		allowed = true
	case "BanIP":
		ip, _ := args["ip"].(string)
		ip = strings.TrimSpace(ip)
		if ip == "" {
			result = "Не указан IP."
			allowed = false
			return
		}
		if !isOwner {
			result = "BanIP доступен только владельцу (Lev)."
			allowed = false
			return
		}
		if a.BanIPFunc != nil {
			if err := a.BanIPFunc(ip); err != nil {
				result = "Ошибка бана IP: " + err.Error()
			} else {
				result = "IP " + ip + " заблокирован."
			}
		} else {
			result = "Функция BanIP не настроена на сервере."
		}
		allowed = true
	case "CheckServerHealth":
		if a.CheckHealthFunc != nil {
			status, err := a.CheckHealthFunc()
			if err != nil {
				result = "Ошибка проверки: " + err.Error()
			} else {
				result = status
			}
		} else if a.GetStats != nil {
			g, m, s := a.GetStats()
			result = fmt.Sprintf("Сервер в работе. Горутины: %d, Память: %.2f MB, Сессий: %d", g, m, s)
		} else {
			result = "Метрики недоступны."
		}
		allowed = true
	default:
		result = "Неизвестная функция: " + name
		allowed = false
	}
	return result, allowed
}
