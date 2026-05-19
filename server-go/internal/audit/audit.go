// Пакет audit: append-only лог админ-действий в admin.audit с хеш-суммой каждой строки (подлог невозможен).
package audit

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const auditFileName = "admin.audit"

var (
	mu  sync.Mutex
	dir = "logs"
)

func init() {
	if d := os.Getenv("AUDIT_LOG_DIR"); d != "" {
		dir = d
	}
}

// Record — одна запись аудита.
type Record struct {
	Timestamp time.Time `json:"ts"`
	AdminID   string    `json:"adminId"`
	AdminName string    `json:"adminName,omitempty"`
	Action    string    `json:"action"`
	TargetID  string    `json:"targetId,omitempty"`
	Target    string    `json:"target,omitempty"`
	Reason    string    `json:"reason,omitempty"`
	IP        string    `json:"ip,omitempty"`
	Extra     string    `json:"extra,omitempty"`
}

// Log пишет запись в admin.audit. Формат строки: JSON + " " + SHA256(JSON) (hex).
func Log(r Record) {
	if r.Timestamp.IsZero() {
		r.Timestamp = time.Now().UTC()
	}
	raw, err := json.Marshal(r)
	if err != nil {
		return
	}
	line := string(raw)
	h := sha256.Sum256([]byte(line))
	hashHex := hex.EncodeToString(h[:])
	entry := line + " " + hashHex + "\n"

	mu.Lock()
	path := filepath.Join(dir, auditFileName)
	mu.Unlock()
	_ = os.MkdirAll(dir, 0750)
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return
	}
	_, _ = f.WriteString(entry)
	_ = f.Sync()
	_ = f.Close()
}

// LogAdminAction — удобный вызов для бан/мут/смена роли.
func LogAdminAction(adminID, adminName, action, targetID, targetName, reason, ip string) {
	Log(Record{
		AdminID:   adminID,
		AdminName: adminName,
		Action:    action,
		TargetID:  targetID,
		Target:    targetName,
		Reason:    reason,
		IP:        ip,
	})
}

// OwnerIPAllowed проверяет, разрешён ли вход владельцу с этого IP (белый список).
// Если файл отсутствует или пуст — разрешаем (bootstrap: первый вход добавит IP).
func OwnerIPAllowed(ip string) bool {
	mu.Lock()
	path := filepath.Join(dir, "owner_allowed_ips.txt")
	mu.Unlock()
	data, err := os.ReadFile(path)
	if err != nil || len(data) == 0 {
		return true
	}
	line := trimSpace(ip)
	lines := splitLines(string(data))
	for _, l := range lines {
		if l == line {
			return true
		}
	}
	return false
}

// OwnerIPAdd добавляет IP в белый список владельца (после первой успешной аутентификации).
func OwnerIPAdd(ip string) {
	mu.Lock()
	path := filepath.Join(dir, "owner_allowed_ips.txt")
	mu.Unlock()
	_ = os.MkdirAll(dir, 0750)
	line := trimSpace(ip)
	if line == "" {
		return
	}
	data, _ := os.ReadFile(path)
	lines := splitLines(string(data))
	for _, l := range lines {
		if l == line {
			return
		}
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return
	}
	_, _ = f.WriteString(line + "\n")
	_ = f.Sync()
	_ = f.Close()
}

// OnOwnerLoginFromNewIP вызывается при попытке входа владельца с нового IP (блокируем и шлём алерт).
var OnOwnerLoginFromNewIP func(ip, username string)

func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 {
		last := len(s) - 1
		if s[last] != ' ' && s[last] != '\t' {
			break
		}
		s = s[:last]
	}
	return s
}

func splitLines(s string) []string {
	var out []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == '\n' {
			line := trimSpace(s[start:i])
			if line != "" {
				out = append(out, line)
			}
			start = i + 1
		}
	}
	return out
}

// ReadLastRecords читает последние limit записей из admin.audit (валидирует хеш).
func ReadLastRecords(limit int) ([]Record, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	mu.Lock()
	path := filepath.Join(dir, auditFileName)
	mu.Unlock()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	lines := splitLines(string(data))
	if len(lines) == 0 {
		return nil, nil
	}
	// Берём последние limit строк
	start := len(lines) - limit
	if start < 0 {
		start = 0
	}
	var out []Record
	for i := len(lines) - 1; i >= start && len(out) < limit; i-- {
		line := lines[i]
		if len(line) < 66 {
			continue
		}
		jsonPart := line[:len(line)-65]
		hashPart := line[len(line)-64:]
		h := sha256.Sum256([]byte(jsonPart))
		if hex.EncodeToString(h[:]) != hashPart {
			continue
		}
		var r Record
		if json.Unmarshal([]byte(jsonPart), &r) == nil {
			out = append(out, r)
		}
	}
	// reverse so oldest first
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}
