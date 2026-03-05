package store

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ——— Роли (иерархия SafeGram). Master Key только у Lev. ———

const (
	RoleOwner     = "owner"     // Lev — полный доступ (только SystemOwnerID)
	RoleAdmin     = "admin"     // управление сервером и пользователями
	RoleGuardian  = "guardian"  // безопасность и бан-лист
	RoleModerator = "moderator" // модерация чатов
	RoleSupport   = "support"   // помощь пользователям
	RoleUser      = "user"      // обычный пользователь
)

// Master Key: единственный владелец (Lev). Проверка по ID или по username.
const SystemOwnerID = "lev"
const SystemOwnerUsername = "lev"

// Действия для проверки прав (HasPermission).
const (
	ActionRestartServer  = "restart_server"
	ActionEditDB         = "edit_db"
	ActionManageServices = "manage_services"
	ActionManageUsers    = "manage_users"
	ActionBlockUser      = "block_user"
	ActionSetUserPlan    = "set_user_plan"
	ActionSetUserRole    = "set_user_role"
	ActionDeleteUser     = "delete_user"
	ActionViewLogs       = "view_logs"
	ActionViewTraffic    = "view_traffic"
	ActionBanIP          = "ban_ip"
	ActionViewSessions   = "view_sessions"
	ActionModerateChats  = "moderate_chats"
	ActionViewReports    = "view_reports"
	ActionViewTickets    = "view_tickets"
	ActionReplyTickets   = "reply_tickets"
	ActionMaintenance    = "maintenance" // вкл/выкл техработы
)

// level возвращает числовой уровень роли (больше = выше).
func roleLevel(role string) int {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case RoleOwner:
		return 5
	case RoleAdmin:
		return 4
	case RoleGuardian:
		return 3
	case RoleModerator:
		return 2
	case RoleSupport:
		return 1
	default:
		return 0
	}
}

// TopRole возвращает высшую роль из строки roles (формат: "owner,admin" или JSON массив).
func TopRole(roles string) string {
	if roles == "" {
		return ""
	}
	roles = strings.TrimSpace(roles)
	if strings.HasPrefix(roles, "[") {
		// Упрощённый парсинг JSON массива
		roles = strings.Trim(roles, "[]")
		roles = strings.ReplaceAll(roles, "\"", "")
	}
	parts := strings.Split(roles, ",")
	top := ""
	topLvl := 0
	for _, p := range parts {
		r := strings.ToLower(strings.TrimSpace(p))
		if r == "" {
			continue
		}
		if l := roleLevel(r); l > topLvl {
			topLvl = l
			top = r
		}
	}
	return top
}

// IsSystemOwner возвращает true, если userID или username принадлежит Lev (Master Key).
func IsSystemOwner(userID, username string) bool {
	id := strings.ToLower(strings.TrimSpace(userID))
	un := strings.ToLower(strings.TrimSpace(username))
	return id == SystemOwnerID || id == SystemOwnerUsername || un == SystemOwnerUsername
}

// HasPermission проверяет, может ли пользователь выполнить действие.
// ownerID и ownerUsername — для проверки Master Key (Lev). Owner-действия только у Lev.
func HasPermission(roles string, ownerID, ownerUsername string, action string) bool {
	top := TopRole(roles)
	lvl := roleLevel(top)
	isOwner := IsSystemOwner(ownerID, ownerUsername) && top == RoleOwner

	// Только Lev получает доступ к критическим действиям
	if action == ActionRestartServer || action == ActionEditDB || action == ActionManageServices || action == ActionDeleteUser {
		return isOwner
	}

	switch action {
	case ActionManageUsers, ActionSetUserPlan, ActionSetUserRole, ActionBlockUser:
		return lvl >= roleLevel(RoleAdmin) || isOwner
	case ActionViewLogs, ActionViewTraffic, ActionBanIP, ActionViewSessions:
		return lvl >= roleLevel(RoleGuardian) || lvl >= roleLevel(RoleAdmin) || isOwner
	case ActionModerateChats, ActionViewReports:
		return lvl >= roleLevel(RoleModerator)
	case ActionViewTickets, ActionReplyTickets:
		return lvl >= roleLevel(RoleSupport)
	case ActionMaintenance:
		return lvl >= roleLevel(RoleAdmin) || isOwner
	default:
		return lvl >= roleLevel(RoleSupport)
	}
}

// ——— Невозможный лог админки (Append-only). Даже админ не может удалить запись. ———

const (
	AdminActionBan              = "Ban"
	AdminActionMute             = "Mute"
	AdminActionConfigChange     = "ConfigChange"
	AdminActionServerRestart    = "ServerRestart"
	AdminActionRoleChange       = "RoleChange"
	AdminActionChannelDelete    = "ChannelDelete"
	AdminActionFailedAdminLogin = "FailedAdminLogin"
	AdminActionAntiDDoS         = "AntiDDoS"
	AdminActionRegistration     = "Registration"
	AdminActionHandshake        = "Handshake"
)

// Severity для цветовой индикации в Intelligence Center.
const (
	SeverityCritical   = "critical"   // красный
	SeverityModeration = "moderation" // оранжевый
	SeverityInfo       = "info"       // синий
)

// AdminLog — одна запись лога. Неизменяемая после записи.
type AdminLog struct {
	Timestamp  time.Time `json:"timestamp"`
	AdminID    string    `json:"adminId"`
	AdminName  string    `json:"adminName,omitempty"`
	ActionType string    `json:"actionType"`
	TargetID   string    `json:"targetId,omitempty"`
	TargetName string    `json:"targetName,omitempty"`
	Reason     string    `json:"reason,omitempty"`
	Severity   string    `json:"severity"` // critical | moderation | info
	Extra      string    `json:"extra,omitempty"`
}

// User — модель пользователя в памяти (по мотивам archive/server-go/models/user.go).
// Role — каноническая роль для enforcement (owner, admin, guardian, moderator, support, user).
// Доступ к RoleOwner только у пользователя с ID/username = SystemOwnerID (Lev).
type User struct {
	ID                string
	Username          string
	Email             string
	Phone             string
	PassHash          string
	CloudPasswordHash string // 2FA: bcrypt/argon2
	IdentityPublicKey []byte // Ed25519 public 32 bytes — для верификации подписей (wallet-style)
	Salt              string
	Roles             string // JSON или "role1,role2" для совместимости
	Role              string // одна роль: owner|admin|guardian|moderator|support|user (enforcement)
	Plan              string
	AvatarURL         string
	About             string
	Status            string
	ProfileColor      string
	ShowBio           bool
	ShowAvatar        bool
	Blocked           bool
	EmailVerified     bool
	PhoneVerified     bool
	LastSeen          *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// HTTPSession — HTTP-сессия (Bearer token). Zero Trust: привязка к устройству, TTL.
type HTTPSession struct {
	Token        string
	UserID       string
	DeviceID     string
	IP           string
	ExpiresAt    time.Time
	LastActivity time.Time
	CreatedAt    time.Time
}

// LoginEvent — событие входа для уведомлений Safety AI (город, устройство).
type LoginEvent struct {
	DeviceID  string
	IP        string
	City      string
	CreatedAt time.Time
}

// SessionState — состояние сессии после ECDH handshake. Self-destruct: TTL и привязка к устройству.
type SessionState struct {
	SessionID    uint64
	Key          []byte
	UserID       string
	ConnAddr     string
	DeviceID     string
	ExpiresAt    time.Time
	LastActivity time.Time
	CreatedAt    time.Time
}

// Room — группа или канал. Сообщения шифруются общим ключом комнаты (RoomKey).
type Room struct {
	ID        string
	Name      string
	Type      string // "group" | "channel"
	RoomKey   []byte // общий ключ для E2EE в комнате
	MemberIDs []string
	OwnerID   string
	CreatedAt time.Time
}

// tempAuth — временный токен многоэтапного входа (SMS → email → 2FA).
type tempAuth struct {
	UserID    string
	ExpiresAt time.Time
}

// smsCode — код SMS с истечением.
type smsCode struct {
	Code      string
	ExpiresAt time.Time
}

// emailCode — код email с истечением.
type emailCode struct {
	Code      string
	ExpiresAt time.Time
}

// failRecord — антибрутфорс: счётчик неудачных попыток и блокировка до.
type failRecord struct {
	Count int
	Until time.Time
}

// Store — in-memory хранилище пользователей, сессий, комнат, Zero Trust данных.
type Store struct {
	mu             sync.RWMutex
	Users          map[string]*User
	Sessions       map[uint64]*SessionState
	HTTPSessions   map[string]*HTTPSession
	Rooms          map[string]*Room
	UserContext    map[string]string
	TempAuth       map[string]*tempAuth
	SMSCodes       map[string]*smsCode     // key: userID
	EmailCodes     map[string]*emailCode   // key: userID
	FailedAttempts map[string]*failRecord  // key: IP
	LoginEvents    map[string][]LoginEvent // key: userID, последние N
	nextID         uint64
	nextUserID     uint64
	nextRoomID     uint64
	maxLoginEvents int
	adminLogPath   string
	adminLogMu     sync.Mutex
	liveStats      LiveStats
	liveStatsMu    sync.RWMutex
}

// LiveStats — метрики для Sovereign (горутины, память, сессии).
type LiveStats struct {
	Goroutines int
	MemoryMB   float64
	Sessions   int
	At         time.Time
}

func (s *Store) SetLiveStats(goroutines int, memoryMB float64, sessions int) {
	s.liveStatsMu.Lock()
	defer s.liveStatsMu.Unlock()
	s.liveStats = LiveStats{Goroutines: goroutines, MemoryMB: memoryMB, Sessions: sessions, At: time.Now()}
}

func (s *Store) GetLiveStats() LiveStats {
	s.liveStatsMu.RLock()
	defer s.liveStatsMu.RUnlock()
	return s.liveStats
}

// NewStore создаёт новое хранилище.
func NewStore() *Store {
	return &Store{
		Users:          make(map[string]*User),
		Sessions:       make(map[uint64]*SessionState),
		HTTPSessions:   make(map[string]*HTTPSession),
		Rooms:          make(map[string]*Room),
		UserContext:    make(map[string]string),
		TempAuth:       make(map[string]*tempAuth),
		SMSCodes:       make(map[string]*smsCode),
		EmailCodes:     make(map[string]*emailCode),
		FailedAttempts: make(map[string]*failRecord),
		LoginEvents:    make(map[string][]LoginEvent),
		maxLoginEvents: 20,
	}
}

// NextSessionID возвращает следующий уникальный ID сессии (thread-safe).
func (s *Store) NextSessionID() uint64 {
	return atomic.AddUint64(&s.nextID, 1)
}

// PutSession сохраняет сессию по ID.
func (s *Store) PutSession(id uint64, state *SessionState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Sessions[id] = state
}

// GetSession возвращает сессию по ID.
func (s *Store) GetSession(id uint64) *SessionState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Sessions[id]
}

// DeleteSession удаляет сессию (при отключении).
func (s *Store) DeleteSession(id uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Sessions, id)
}

// TCPSessionCount возвращает количество активных TCP-сессий (для метрик админки).
func (s *Store) TCPSessionCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.Sessions)
}

// GetUserByID возвращает пользователя по ID.
func (s *Store) GetUserByID(id string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Users[id]
}

// GetUserByUsername ищет пользователя по логину (для будущего логина).
func (s *Store) GetUserByUsername(username string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.Users {
		if u.Username == username {
			return u
		}
	}
	return nil
}

// NormalizeUserRole выставляет User.Role из Roles (TopRole). Owner только если IsSystemOwner.
func NormalizeUserRole(u *User) {
	if u == nil {
		return
	}
	top := TopRole(u.Roles)
	if top != "" {
		u.Role = top
		return
	}
	if u.Role == "" {
		u.Role = RoleUser
	}
	// Owner только для Lev: даже если в БД прописан owner, без совпадения ID/username — сбрасываем.
	if u.Role == RoleOwner && !IsSystemOwner(u.ID, u.Username) {
		u.Role = RoleUser
	}
}

// PutUser сохраняет или обновляет пользователя. Синхронизирует Role из Roles.
func (s *Store) PutUser(u *User) {
	NormalizeUserRole(u)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Users[u.ID] = u
}

// NextUserID возвращает следующий уникальный ID пользователя (thread-safe).
func (s *Store) NextUserID() string {
	id := atomic.AddUint64(&s.nextUserID, 1)
	return "u" + strconv.FormatUint(id, 10)
}

// ListUsers returns all users (for admin). Excludes PassHash.
func (s *Store) ListUsers() []*User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*User, 0, len(s.Users))
	for _, u := range s.Users {
		cp := *u
		cp.PassHash = ""
		out = append(out, &cp)
	}
	return out
}

// SetUserBlocked sets Blocked for user id.
func (s *Store) SetUserBlocked(id string, blocked bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u, ok := s.Users[id]; ok {
		u.Blocked = blocked
	}
}

// SetUserRole sets Roles for user id and canonical Role (owner only if IsSystemOwner).
func (s *Store) SetUserRole(id string, role string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u, ok := s.Users[id]; ok {
		u.Roles = role
		r := strings.ToLower(strings.TrimSpace(role))
		if r == RoleOwner && !IsSystemOwner(u.ID, u.Username) {
			u.Role = RoleUser
		} else if r != "" {
			u.Role = r
		} else {
			u.Role = RoleUser
		}
	}
}

// GetUserContext returns stored context JSON for user (schedule, projects, etc.).
func (s *Store) GetUserContext(userID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.UserContext[userID]
}

// SetUserContext saves context JSON for user.
func (s *Store) SetUserContext(userID, json string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if json == "" {
		delete(s.UserContext, userID)
		return
	}
	s.UserContext[userID] = json
}

// NextRoomID returns next unique room ID.
func (s *Store) NextRoomID() string {
	id := atomic.AddUint64(&s.nextRoomID, 1)
	return "r" + strconv.FormatUint(id, 10)
}

// PutRoom saves or updates a room.
func (s *Store) PutRoom(r *Room) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Rooms[r.ID] = r
}

// GetRoom returns room by ID.
func (s *Store) GetRoom(id string) *Room {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Rooms[id]
}

// ListRoomsForUser returns room IDs where user is member.
func (s *Store) ListRoomsForUser(userID string) []*Room {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []*Room
	for _, r := range s.Rooms {
		for _, m := range r.MemberIDs {
			if m == userID {
				out = append(out, r)
				break
			}
		}
	}
	return out
}

// ——— Zero Trust: HTTP-сессии ———

func (s *Store) PutHTTPSession(sess *HTTPSession) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.HTTPSessions[sess.Token] = sess
}

func (s *Store) GetHTTPSessionByToken(token string) *HTTPSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.HTTPSessions[token]
}

func (s *Store) DeleteHTTPSession(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.HTTPSessions, token)
}

func (s *Store) ListHTTPSessionsForUser(userID string) []*HTTPSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []*HTTPSession
	for _, sess := range s.HTTPSessions {
		if sess.UserID == userID {
			out = append(out, sess)
		}
	}
	return out
}

// ListAllHTTPSessions возвращает все HTTP-сессии (для админки).
func (s *Store) ListAllHTTPSessions() []*HTTPSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*HTTPSession, 0, len(s.HTTPSessions))
	for _, sess := range s.HTTPSessions {
		out = append(out, sess)
	}
	return out
}

func (s *Store) DeleteHTTPSessionsForUserExcept(userID, keepToken string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for tok, sess := range s.HTTPSessions {
		if sess.UserID == userID && tok != keepToken {
			delete(s.HTTPSessions, tok)
		}
	}
}

func (s *Store) CleanExpiredHTTPSessions(now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for tok, sess := range s.HTTPSessions {
		if sess.ExpiresAt.Before(now) {
			delete(s.HTTPSessions, tok)
		}
	}
}

// ——— Временный токен многоэтапного входа ———

func (s *Store) PutTempAuth(token string, userID string, expiresAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TempAuth[token] = &tempAuth{UserID: userID, ExpiresAt: expiresAt}
}

func (s *Store) GetTempAuth(token string) (userID string, ok bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.TempAuth[token]
	if !ok || t.ExpiresAt.Before(time.Now()) {
		return "", false
	}
	return t.UserID, true
}

func (s *Store) DeleteTempAuth(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.TempAuth, token)
}

// ——— SMS / Email коды (эмуляция) ———

func (s *Store) PutSMSCode(userID, code string, expiresAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.SMSCodes[userID] = &smsCode{Code: code, ExpiresAt: expiresAt}
}

func (s *Store) VerifySMSCode(userID, code string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.SMSCodes[userID]
	if !ok || c.ExpiresAt.Before(time.Now()) {
		return false
	}
	if c.Code != code {
		return false
	}
	delete(s.SMSCodes, userID)
	return true
}

func (s *Store) PutEmailCode(userID, code string, expiresAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.EmailCodes[userID] = &emailCode{Code: code, ExpiresAt: expiresAt}
}

func (s *Store) VerifyEmailCode(userID, code string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.EmailCodes[userID]
	if !ok || c.ExpiresAt.Before(time.Now()) {
		return false
	}
	if c.Code != code {
		return false
	}
	delete(s.EmailCodes, userID)
	return true
}

// ——— Антибрутфорс ———

func (s *Store) RecordFailedLogin(ip string) {
	// Авто-блокировка IP отключена: блокировать IP можно только вручную из админки.
	_ = ip
}

func (s *Store) IsIPBlocked(ip string) bool {
	// Авто-блокировка IP отключена: блокировать IP можно только вручную из админки.
	_ = ip
	return false
}

func (s *Store) ResetFailedLogin(ip string) {
	// Авто-блокировка IP отключена: метод оставлен для обратной совместимости.
	_ = ip
}

// ——— События входа (Safety AI уведомления) ———

func (s *Store) AddLoginEvent(userID string, ev LoginEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.LoginEvents[userID]
	list = append(list, ev)
	if len(list) > s.maxLoginEvents {
		list = list[len(list)-s.maxLoginEvents:]
	}
	s.LoginEvents[userID] = list
}

func (s *Store) GetLoginEvents(userID string) []LoginEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]LoginEvent(nil), s.LoginEvents[userID]...)
}

// SetAdminLogPath задаёт путь к append-only файлу логов админки. Вызывать при старте сервера.
func (s *Store) SetAdminLogPath(path string) {
	s.adminLogMu.Lock()
	defer s.adminLogMu.Unlock()
	s.adminLogPath = path
}

// AppendLog записывает действие в защищённый append-only файл. Удаление записей невозможно.
func (s *Store) AppendLog(log AdminLog) {
	s.adminLogMu.Lock()
	path := s.adminLogPath
	s.adminLogMu.Unlock()
	if path == "" {
		path = "admin_audit.log"
	}
	dir := filepath.Dir(path)
	if dir != "." {
		_ = os.MkdirAll(dir, 0750)
	}
	raw, err := json.Marshal(log)
	if err != nil {
		return
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return
	}
	_, _ = f.Write(raw)
	_, _ = f.Write([]byte("\n"))
	_ = f.Sync()
	_ = f.Close()
	WriteAuditRecord(log)
}

// ReadLogs возвращает последние limit записей (новые сверху). Если limit <= 0, возвращает все.
func (s *Store) ReadLogs(limit int) ([]AdminLog, error) {
	s.adminLogMu.Lock()
	path := s.adminLogPath
	s.adminLogMu.Unlock()
	if path == "" {
		path = "admin_audit.log"
	}
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	defer f.Close()
	var lines []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		lines = append(lines, sc.Text())
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	var out []AdminLog
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}
		var log AdminLog
		if json.Unmarshal([]byte(line), &log) != nil {
			continue
		}
		out = append(out, log)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out, nil
}
