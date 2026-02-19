package store

import (
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

// User — модель пользователя в памяти (по мотивам archive/server-go/models/user.go).
// Регистрация/логин через API — позже; пока только структура для хранения.
type User struct {
	ID                string
	Username          string
	Email             string
	Phone             string
	PassHash          string
	CloudPasswordHash string // 2FA: bcrypt/argon2
	Salt              string
	Roles             string
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
	SessionID   uint64
	Key         []byte
	UserID      string
	ConnAddr    string
	DeviceID    string
	ExpiresAt   time.Time
	LastActivity time.Time
	CreatedAt   time.Time
}

// Room — группа или канал. Сообщения шифруются общим ключом комнаты (RoomKey).
type Room struct {
	ID        string
	Name      string
	Type      string   // "group" | "channel"
	RoomKey   []byte   // общий ключ для E2EE в комнате
	MemberIDs []string
	OwnerID   string
	CreatedAt time.Time
}

// tempAuth — временный токен многоэтапного входа (SMS → email → 2FA).
type tempAuth struct {
	UserID   string
	ExpiresAt time.Time
}

// smsCode — код SMS с истечением.
type smsCode struct {
	Code     string
	ExpiresAt time.Time
}

// emailCode — код email с истечением.
type emailCode struct {
	Code     string
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
	SMSCodes       map[string]*smsCode   // key: userID
	EmailCodes     map[string]*emailCode // key: userID
	FailedAttempts map[string]*failRecord // key: IP
	LoginEvents    map[string][]LoginEvent // key: userID, последние N
	nextID         uint64
	nextUserID     uint64
	nextRoomID     uint64
	maxLoginEvents int
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

// PutUser сохраняет или обновляет пользователя.
func (s *Store) PutUser(u *User) {
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

// SetUserRole sets Roles for user id (e.g. "user", "admin").
func (s *Store) SetUserRole(id string, role string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u, ok := s.Users[id]; ok {
		u.Roles = role
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
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.FailedAttempts[ip] == nil {
		s.FailedAttempts[ip] = &failRecord{}
	}
	s.FailedAttempts[ip].Count++
	if s.FailedAttempts[ip].Count >= 5 {
		s.FailedAttempts[ip].Until = time.Now().Add(15 * time.Minute)
	}
}

func (s *Store) IsIPBlocked(ip string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	f := s.FailedAttempts[ip]
	if f == nil {
		return false
	}
	if f.Count < 5 {
		return false
	}
	return time.Now().Before(f.Until)
}

func (s *Store) ResetFailedLogin(ip string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.FailedAttempts, ip)
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
