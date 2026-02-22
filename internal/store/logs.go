// Пакет store: бинарный append-only лог админ-действий в logs/admin_audit.dat.
// Ни одно админ-действие не должно проходить мимо лога.
package store

import (
	"encoding/binary"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

const (
	auditLogDir  = "logs"
	auditLogFile = "admin_audit.dat"
)

var (
	auditMu     sync.Mutex
	auditPath   string
	auditSubs   []chan []AdminLog
	auditNotify = make(chan struct{}, 1)
)

func init() {
	auditPath = filepath.Join(auditLogDir, auditLogFile)
}

// SetAuditLogPath задаёт путь к бинарному лог-файлу (по умолчанию logs/admin_audit.dat).
func SetAuditLogPath(path string) {
	auditMu.Lock()
	defer auditMu.Unlock()
	auditPath = path
}

// WriteAuditRecord записывает одну запись в бинарный лог. Append-only, неизменяемо.
// Формат: 4 байта length (LittleEndian) || JSON(AdminLog).
func WriteAuditRecord(log AdminLog) {
	raw, err := json.Marshal(log)
	if err != nil {
		return
	}
	auditMu.Lock()
	path := auditPath
	auditMu.Unlock()
	dir := filepath.Dir(path)
	if dir != "" {
		_ = os.MkdirAll(dir, 0750)
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return
	}
	lenBuf := make([]byte, 4)
	binary.LittleEndian.PutUint32(lenBuf, uint32(len(raw)))
	_, _ = f.Write(lenBuf)
	_, _ = f.Write(raw)
	_ = f.Sync()
	_ = f.Close()
	// Уведомление подписчиков стриминга
	select {
	case auditNotify <- struct{}{}:
	default:
	}
	notifyAuditSubs([]AdminLog{log})
}

func notifyAuditSubs(entries []AdminLog) {
	auditMu.Lock()
	subs := make([]chan []AdminLog, len(auditSubs))
	copy(subs, auditSubs)
	auditMu.Unlock()
	for _, ch := range subs {
		select {
		case ch <- entries:
		default:
		}
	}
}

// ReadAuditLog читает последние limit записей из бинарного лога (новые первыми).
func ReadAuditLog(limit int) ([]AdminLog, error) {
	auditMu.Lock()
	path := auditPath
	auditMu.Unlock()
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	defer f.Close()
	var all []AdminLog
	buf := make([]byte, 4)
	for {
		if _, err := f.Read(buf); err != nil {
			break
		}
		recLen := binary.LittleEndian.Uint32(buf)
		if recLen > 4*1024*1024 {
			break
		}
		rec := make([]byte, recLen)
		if _, err := f.Read(rec); err != nil {
			break
		}
		var log AdminLog
		if json.Unmarshal(rec, &log) != nil {
			continue
		}
		all = append(all, log)
	}
	// Развернуть: в файле старые первые, нужны новые первые
	for i, j := 0, len(all)-1; i < j; i, j = i+1, j-1 {
		all[i], all[j] = all[j], all[i]
	}
	if limit > 0 && len(all) > limit {
		all = all[:limit]
	}
	return all, nil
}

// SubscribeAudit возвращает канал, в который приходят новые записи лога (для стриминга).
// Вызывающий должен читать из канала и закрыть его при отписке через Close() возвращённого closer.
func SubscribeAudit() (ch <-chan []AdminLog, closeFn func()) {
	c := make(chan []AdminLog, 8)
	auditMu.Lock()
	auditSubs = append(auditSubs, c)
	auditMu.Unlock()
	return c, func() {
		auditMu.Lock()
		for i, s := range auditSubs {
			if s == c {
				auditSubs = append(auditSubs[:i], auditSubs[i+1:]...)
				break
			}
		}
		auditMu.Unlock()
		close(c)
	}
}

