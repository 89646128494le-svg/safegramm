package logger

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type LogLevel string

const (
	LogLevelInfo    LogLevel = "info"
	LogLevelWarning LogLevel = "warning"
	LogLevelError   LogLevel = "error"
	LogLevelDebug   LogLevel = "debug"
)

type LogEntry struct {
	Level      LogLevel              `json:"level"`
	Message    string                `json:"message"`
	Timestamp  time.Time             `json:"timestamp"`
	Service    string                `json:"service,omitempty"`
	UserID     string                `json:"userId,omitempty"`
	ChatID     string                `json:"chatId,omitempty"`
	Action     string                `json:"action,omitempty"`
	Error      string                `json:"error,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	IP         string                `json:"ip,omitempty"`
	UserAgent  string                `json:"userAgent,omitempty"`
}

type Logger struct {
	webhookURL string
	enabled    bool
	client     *http.Client
	mu         sync.Mutex
	buffer     []LogEntry
	bufferSize int
}

var defaultLogger *Logger

func Init(webhookURL string, enabled bool) {
	defaultLogger = &Logger{
		webhookURL: webhookURL,
		enabled:    enabled,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		buffer:     make([]LogEntry, 0),
		bufferSize: 50,
	}
	
	if enabled && webhookURL != "" {
		log.Printf("✅ Logger initialized with webhook: %s", maskURL(webhookURL))
	} else {
		log.Println("📝 Logger initialized (webhook disabled)")
	}
}

func maskURL(url string) string {
	if len(url) > 50 {
		return url[:20] + "..." + url[len(url)-20:]
	}
	return url
}

func SetWebhook(webhookURL string) {
	if defaultLogger == nil {
		Init(webhookURL, webhookURL != "")
		return
	}
	defaultLogger.mu.Lock()
	defer defaultLogger.mu.Unlock()
	defaultLogger.webhookURL = webhookURL
	defaultLogger.enabled = webhookURL != ""
	log.Printf("🔔 Webhook updated: %s", maskURL(webhookURL))
}

func GetWebhook() string {
	if defaultLogger == nil {
		return ""
	}
	defaultLogger.mu.Lock()
	defer defaultLogger.mu.Unlock()
	return defaultLogger.webhookURL
}

func Log(level LogLevel, message string, metadata map[string]interface{}) {
	entry := LogEntry{
		Level:     level,
		Message:   message,
		Timestamp: time.Now(),
		Metadata:  metadata,
	}
	
	// Стандартное логирование
	logMsg := fmt.Sprintf("[%s] %s", level, message)
	if metadata != nil && len(metadata) > 0 {
		if metaStr, err := json.Marshal(metadata); err == nil {
			logMsg += " " + string(metaStr)
		}
	}
	log.Println(logMsg)
	
	// Отправка на webhook
	if defaultLogger != nil && defaultLogger.enabled && defaultLogger.webhookURL != "" {
		defaultLogger.sendToWebhook(entry)
	}
}

func Info(message string, metadata map[string]interface{}) {
	Log(LogLevelInfo, message, metadata)
}

func Warning(message string, metadata map[string]interface{}) {
	Log(LogLevelWarning, message, metadata)
}

func Error(message string, err error, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	if err != nil {
		metadata["error"] = err.Error()
	}
	Log(LogLevelError, message, metadata)
}

func Debug(message string, metadata map[string]interface{}) {
	if os.Getenv("NODE_ENV") == "development" {
		Log(LogLevelDebug, message, metadata)
	}
}

func LogAction(action string, userId string, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["action"] = action
	metadata["userId"] = userId
	Info(fmt.Sprintf("Action: %s", action), metadata)
}

func LogError(message string, err error, service string, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["service"] = service
	if err != nil {
		metadata["error"] = err.Error()
	}
	Error(message, err, metadata)
}

func (l *Logger) sendToWebhook(entry LogEntry) {
	l.mu.Lock()
	l.buffer = append(l.buffer, entry)
	bufferFull := len(l.buffer) >= l.bufferSize
	l.mu.Unlock()
	
	// Отправляем сразу для важных событий или при заполнении буфера
	if entry.Level == LogLevelError || bufferFull {
		l.flushBuffer()
	}
}

func (l *Logger) flushBuffer() {
	l.mu.Lock()
	if len(l.buffer) == 0 {
		l.mu.Unlock()
		return
	}
	
	entries := make([]LogEntry, len(l.buffer))
	copy(entries, l.buffer)
	l.buffer = l.buffer[:0]
	l.mu.Unlock()
	
	// Отправляем в отдельной горутине
	go func() {
		payload := map[string]interface{}{
			"logs": entries,
			"server": os.Getenv("SERVER_NAME"),
		}
		
		jsonData, err := json.Marshal(payload)
		if err != nil {
			log.Printf("Failed to marshal log entry: %v", err)
			return
		}
		
		req, err := http.NewRequest("POST", l.webhookURL, bytes.NewBuffer(jsonData))
		if err != nil {
			log.Printf("Failed to create webhook request: %v", err)
			return
		}
		
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "SafeGram-Server/1.0")
		
		resp, err := l.client.Do(req)
		if err != nil {
			log.Printf("Failed to send webhook: %v", err)
			return
		}
		defer resp.Body.Close()
		
		if resp.StatusCode != http.StatusOK {
			log.Printf("Webhook returned non-200 status: %d", resp.StatusCode)
		}
	}()
}

// Flush принудительно отправляет все буферизованные логи
func Flush() {
	if defaultLogger != nil {
		defaultLogger.flushBuffer()
	}
}
