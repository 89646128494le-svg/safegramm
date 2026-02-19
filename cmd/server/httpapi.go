package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/89646128494le-svg/safegram-core/internal/email"
	"github.com/89646128494le-svg/safegram-core/internal/engine"
	"github.com/89646128494le-svg/safegram-core/internal/store"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
)

const httpAddr = ":8081"
const defaultSessionTTL = 7 * 24 * time.Hour
const tempAuthTTL = 15 * time.Minute
const smsCodeTTL = 5 * time.Minute
const emailCodeTTL = 10 * time.Minute

// runHTTPAPI запускает HTTP API :8081. Используется только для выдачи токена (SafeGuard MFA: пароль → 6-значный код → облачный пароль),
// профиля, Safety AI и админки. Трафик сообщений — только бинарный (GET /ws или TCP :8080), шифрование AES-256-GCM, Curve25519.
func runHTTPAPI(s *store.Store, g *transport.Guard) {
	if g == nil {
		g = transport.NewGuard()
	}
	go func() {
		tick := time.NewTicker(5 * time.Minute)
		for range tick.C {
			s.CleanExpiredHTTPSessions(time.Now())
		}
	}()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/register", handleRegister(s))
	mux.HandleFunc("POST /api/auth/login", handleLogin(s))
	mux.HandleFunc("POST /api/auth/request-sms", handleRequestSMS(s))
	mux.HandleFunc("POST /api/auth/verify-sms", handleVerifySMS(s))
	mux.HandleFunc("POST /api/auth/request-email-code", handleRequestEmailCode(s))
	mux.HandleFunc("POST /api/auth/verify-email", handleVerifyEmail(s))
	mux.HandleFunc("POST /api/auth/2fa", handle2FA(s))
	mux.HandleFunc("GET /api/users/me", authRequired(s, handleGetMe(s)))
	mux.HandleFunc("PUT /api/users/me", authRequired(s, handleUpdateMe(s)))
	mux.HandleFunc("GET /api/users/me/context", authRequired(s, handleGetContext(s)))
	mux.HandleFunc("PUT /api/users/me/context", authRequired(s, handleSetContext(s)))
	mux.HandleFunc("GET /api/security/sessions", authRequired(s, handleListSessions(s)))
	mux.HandleFunc("POST /api/security/sessions/terminate-others", authRequired(s, handleTerminateOtherSessions(s)))
	mux.HandleFunc("GET /api/security/login-events", authRequired(s, handleLoginEvents(s)))
	mux.HandleFunc("GET /api/security/protection", authRequired(s, handleProtection(s)))
	mux.HandleFunc("PUT /api/security/cloud-password", authRequired(s, handleSetCloudPassword(s)))
	mux.HandleFunc("POST /api/safety/ask", authRequired(s, handleSafetyAsk(s)))
	mux.HandleFunc("GET /api/maintenance/status", handleMaintenanceStatus(s))
	mux.HandleFunc("POST /api/admin/maintenance", adminRequired(s, handleMaintenanceOn(s)))
	mux.HandleFunc("POST /api/admin/maintenance/disable", adminRequired(s, handleMaintenanceOff))
	mux.HandleFunc("GET /api/admin/users", adminRequired(s, handleAdminListUsers(s)))
	mux.HandleFunc("POST /api/admin/users/{id}/block", adminRequired(s, handleAdminBlockUser(s)))
	mux.HandleFunc("PUT /api/admin/users/{id}/plan", adminRequired(s, handleAdminSetPlan(s)))
	mux.HandleFunc("POST /api/admin/notify", adminRequired(s, handleAdminNotify))
	mux.HandleFunc("POST /api/admin/send-email", adminRequired(s, handleAdminSendEmail(s)))
	mux.HandleFunc("POST /api/admin/broadcast-email", adminRequired(s, handleAdminBroadcastEmail(s)))
	mux.HandleFunc("GET /api/admin/blocked-ips", adminRequired(s, handleAdminBlockedIPs(g)))
	mux.HandleFunc("GET /api/admin/stats", adminRequired(s, handleAdminStats(s, g)))
	mux.HandleFunc("GET /api/admin/traffic", adminRequired(s, handleAdminTraffic(g)))
	mux.HandleFunc("POST /api/admin/ban-ip", adminRequired(s, handleAdminBanIP(g)))
	mux.HandleFunc("GET /api/admin/ddos-settings", adminRequired(s, handleAdminDDoSSettingsGet(g)))
	mux.HandleFunc("PUT /api/admin/ddos-settings", adminRequired(s, handleAdminDDoSSettingsPut(g)))
	mux.HandleFunc("PUT /api/admin/users/{id}/role", adminRequired(s, handleAdminSetRole(s)))
	mux.HandleFunc("POST /api/admin/users/{id}/reset-password", adminRequired(s, handleAdminResetPassword(s)))
	mux.HandleFunc("GET /api/admin/metrics", adminRequired(s, handleAdminMetrics(s, g)))
	mux.HandleFunc("GET /api/admin/sessions", adminRequired(s, handleAdminSessions(s)))
	mux.HandleFunc("GET /api/notify/status", handleNotifyStatus)
	mux.HandleFunc("GET /api/rooms", authRequired(s, handleListRooms(s)))
	mux.HandleFunc("POST /api/rooms", authRequired(s, handleCreateRoom(s)))
	mux.HandleFunc("GET /api/dev/status", authRequired(s, handleDevStatus))
	mux.HandleFunc("GET /ws", handleWebSocket(s))
	server := &http.Server{Addr: httpAddr, Handler: cors(mux)}
	_ = server.ListenAndServe()
}

func getClientIP(r *http.Request) string {
	if x := r.Header.Get("X-Forwarded-For"); x != "" {
		if i := strings.Index(x, ","); i > 0 {
			return strings.TrimSpace(x[:i])
		}
		return strings.TrimSpace(x)
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if host != "" {
		return host
	}
	return r.RemoteAddr
}

func cors(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func handleRegister(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Email    string `json:"email"`
			Phone    string `json:"phone"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		req.Username = strings.TrimSpace(req.Username)
		if req.Username == "" || len(req.Password) < 6 {
			jsonError(w, "Username required, password at least 6 characters", http.StatusBadRequest)
			return
		}
		if s.GetUserByUsername(req.Username) != nil {
			jsonError(w, "Username already taken", http.StatusConflict)
			return
		}
		hash, err := engine.HashPassword(req.Password)
		if err != nil {
			jsonError(w, "Server error", http.StatusInternalServerError)
			return
		}
		now := time.Now()
		u := &store.User{
			ID:            s.NextUserID(),
			Username:      req.Username,
			Email:         strings.TrimSpace(req.Email),
			Phone:         strings.TrimSpace(req.Phone),
			PassHash:      hash,
			Roles:         "user",
			Plan:          "free",
			Status:        "offline",
			About:         "",
			EmailVerified: false,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		s.PutUser(u)
		userResponse(w, u, http.StatusCreated)
	}
}

func handleLogin(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
		if s.IsIPBlocked(ip) {
			jsonError(w, "Too many failed attempts. Try again in 15 minutes.", http.StatusTooManyRequests)
			return
		}
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			DeviceID string `json:"deviceId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		u := s.GetUserByUsername(strings.TrimSpace(req.Username))
		if u == nil {
			s.RecordFailedLogin(ip)
			jsonError(w, "Invalid username or password", http.StatusUnauthorized)
			return
		}
		if err := engine.VerifyPassword(u.PassHash, req.Password); err != nil {
			s.RecordFailedLogin(ip)
			jsonError(w, "Invalid username or password", http.StatusUnauthorized)
			return
		}
		s.ResetFailedLogin(ip)
		// Session Pinning: привязка сессии к устройству (X-Device-ID). Если не передан — генерируем и вернём в ответе.
		deviceID := strings.TrimSpace(req.DeviceID)
		if deviceID == "" {
			deviceID = mustRandomToken()[:16]
		}
		// SafeGuard MFA: пароль → 6-значный код (Email/SMS) → облачный пароль (store).
		// Multi-step: SMS → Email → 2FA
		if u.Phone != "" {
			tempToken := mustRandomToken()
			s.PutTempAuth(tempToken, u.ID, time.Now().Add(tempAuthTTL))
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"needSms": true, "tempToken": tempToken, "userId": u.ID, "deviceId": deviceID,
			})
			return
		}
		if u.Email != "" && !u.EmailVerified {
			tempToken := mustRandomToken()
			s.PutTempAuth(tempToken, u.ID, time.Now().Add(tempAuthTTL))
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"needEmail": true, "tempToken": tempToken, "userId": u.ID, "deviceId": deviceID,
			})
			return
		}
		if u.CloudPasswordHash != "" {
			tempToken := mustRandomToken()
			s.PutTempAuth(tempToken, u.ID, time.Now().Add(tempAuthTTL))
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"need2FA": true, "tempToken": tempToken, "userId": u.ID, "deviceId": deviceID,
			})
			return
		}
		// Нет дополнительных шагов — создаём сессию (Session Pinning: deviceID сохранён в сессии).
		token, sess := createHTTPSession(s, u.ID, deviceID, ip)
		s.AddLoginEvent(u.ID, store.LoginEvent{DeviceID: deviceID, IP: ip, CreatedAt: time.Now()})
		userResponseWithToken(w, u, token, sess, http.StatusOK)
	}
}

func mustRandomToken() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

func randomDigits(n int) string {
	const digits = "0123456789"
	out := make([]byte, n)
	for i := 0; i < n; i++ {
		bigN, _ := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		out[i] = digits[bigN.Int64()]
	}
	return string(out)
}

func createHTTPSession(s *store.Store, userID, deviceID, ip string) (string, *store.HTTPSession) {
	now := time.Now()
	token := mustRandomToken()
	sess := &store.HTTPSession{
		Token:        token,
		UserID:       userID,
		DeviceID:     deviceID,
		IP:           ip,
		ExpiresAt:    now.Add(defaultSessionTTL),
		LastActivity: now,
		CreatedAt:    now,
	}
	s.PutHTTPSession(sess)
	return token, sess
}

func handleRequestSMS(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TempToken string `json:"tempToken"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		userID, ok := s.GetTempAuth(req.TempToken)
		if !ok {
			jsonError(w, "Invalid or expired temp token", http.StatusUnauthorized)
			return
		}
		code := randomDigits(6)
		s.PutSMSCode(userID, code, time.Now().Add(smsCodeTTL))
		// Эмуляция: в продакшене — шлюз SMS
		fmt.Printf("[SafeGram] SMS code for user %s: %s (emulated)\n", userID, code)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "message": "SMS sent (emulated)"})
	}
}

func handleVerifySMS(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TempToken string `json:"tempToken"`
			Code     string `json:"code"`
			DeviceID string `json:"deviceId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		userID, ok := s.GetTempAuth(req.TempToken)
		if !ok {
			jsonError(w, "Invalid or expired temp token", http.StatusUnauthorized)
			return
		}
		if !s.VerifySMSCode(userID, strings.TrimSpace(req.Code)) {
			jsonError(w, "Invalid or expired SMS code", http.StatusUnauthorized)
			return
		}
		s.DeleteTempAuth(req.TempToken)
		u := s.GetUserByID(userID)
		if u == nil {
			jsonError(w, "User not found", http.StatusUnauthorized)
			return
		}
		deviceID := strings.TrimSpace(req.DeviceID)
		if deviceID == "" {
			deviceID = "unknown"
		}
		ip := getClientIP(r)
		// Next: email or 2FA?
		if u.Email != "" && !u.EmailVerified {
			tempToken := mustRandomToken()
			s.PutTempAuth(tempToken, u.ID, time.Now().Add(tempAuthTTL))
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"needEmail": true, "tempToken": tempToken, "userId": u.ID, "deviceId": deviceID,
			})
			return
		}
		if u.CloudPasswordHash != "" {
			tempToken := mustRandomToken()
			s.PutTempAuth(tempToken, u.ID, time.Now().Add(tempAuthTTL))
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"need2FA": true, "tempToken": tempToken, "userId": u.ID, "deviceId": deviceID,
			})
			return
		}
		token, sess := createHTTPSession(s, u.ID, deviceID, ip)
		s.AddLoginEvent(u.ID, store.LoginEvent{DeviceID: deviceID, IP: ip, CreatedAt: time.Now()})
		userResponseWithToken(w, u, token, sess, http.StatusOK)
	}
}

func handleRequestEmailCode(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TempToken string `json:"tempToken"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		userID, ok := s.GetTempAuth(req.TempToken)
		if !ok {
			jsonError(w, "Invalid or expired temp token", http.StatusUnauthorized)
			return
		}
		code := randomDigits(6)
		s.PutEmailCode(userID, code, time.Now().Add(emailCodeTTL))
		u := s.GetUserByID(userID)
		email := ""
		if u != nil {
			email = u.Email
		}
		fmt.Printf("[SafeGram] Email code for user %s (%s): %s (emulated)\n", userID, email, code)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "message": "Email sent (emulated)"})
	}
}

func handleVerifyEmail(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TempToken string `json:"tempToken"`
			Code     string `json:"code"`
			DeviceID string `json:"deviceId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		userID, ok := s.GetTempAuth(req.TempToken)
		if !ok {
			jsonError(w, "Invalid or expired temp token", http.StatusUnauthorized)
			return
		}
		if !s.VerifyEmailCode(userID, strings.TrimSpace(req.Code)) {
			jsonError(w, "Invalid or expired email code", http.StatusUnauthorized)
			return
		}
		s.DeleteTempAuth(req.TempToken)
		u := s.GetUserByID(userID)
		if u == nil {
			jsonError(w, "User not found", http.StatusUnauthorized)
			return
		}
		u.EmailVerified = true
		s.PutUser(u)
		deviceID := strings.TrimSpace(req.DeviceID)
		if deviceID == "" {
			deviceID = "unknown"
		}
		ip := getClientIP(r)
		if u.CloudPasswordHash != "" {
			tempToken := mustRandomToken()
			s.PutTempAuth(tempToken, u.ID, time.Now().Add(tempAuthTTL))
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"need2FA": true, "tempToken": tempToken, "userId": u.ID, "deviceId": deviceID,
			})
			return
		}
		token, sess := createHTTPSession(s, u.ID, deviceID, ip)
		s.AddLoginEvent(u.ID, store.LoginEvent{DeviceID: deviceID, IP: ip, CreatedAt: time.Now()})
		userResponseWithToken(w, u, token, sess, http.StatusOK)
	}
}

func handle2FA(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TempToken    string `json:"tempToken"`
			CloudPassword string `json:"cloudPassword"`
			DeviceID     string `json:"deviceId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		userID, ok := s.GetTempAuth(req.TempToken)
		if !ok {
			jsonError(w, "Invalid or expired temp token", http.StatusUnauthorized)
			return
		}
		u := s.GetUserByID(userID)
		if u == nil || u.CloudPasswordHash == "" {
			jsonError(w, "2FA not configured", http.StatusBadRequest)
			return
		}
		if err := engine.VerifyPassword(u.CloudPasswordHash, req.CloudPassword); err != nil {
			jsonError(w, "Invalid cloud password", http.StatusUnauthorized)
			return
		}
		s.DeleteTempAuth(req.TempToken)
		deviceID := strings.TrimSpace(req.DeviceID)
		if deviceID == "" {
			deviceID = "unknown"
		}
		ip := getClientIP(r)
		token, sess := createHTTPSession(s, u.ID, deviceID, ip)
		s.AddLoginEvent(u.ID, store.LoginEvent{DeviceID: deviceID, IP: ip, CreatedAt: time.Now()})
		userResponseWithToken(w, u, token, sess, http.StatusOK)
	}
}

func userResponseWithToken(w http.ResponseWriter, u *store.User, token string, sess *store.HTTPSession, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token, "sessionExpiresAt": sess.ExpiresAt, "deviceId": sess.DeviceID,
		"id": u.ID, "username": u.Username, "email": u.Email,
		"roles": u.Roles, "plan": u.Plan, "avatarUrl": u.AvatarURL,
		"status": u.Status, "about": u.About, "blocked": u.Blocked,
	})
}

// Session Pinning: при смене устройства сессия аннулируется.

func authRequired(s *store.Store, next func(http.ResponseWriter, *http.Request, *store.User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" {
			jsonError(w, "Authorization required", http.StatusUnauthorized)
			return
		}
		sess := s.GetHTTPSessionByToken(token)
		var u *store.User
		if sess != nil {
			if time.Now().After(sess.ExpiresAt) {
				s.DeleteHTTPSession(token)
				jsonError(w, "Session expired", http.StatusUnauthorized)
				return
			}
			deviceID := strings.TrimSpace(r.Header.Get("X-Device-ID"))
			// Session Pinning: если сессия привязана к устройству — заголовок должен совпадать.
			if sess.DeviceID != "" && sess.DeviceID != "unknown" && deviceID != sess.DeviceID {
				s.DeleteHTTPSession(token)
				jsonError(w, "Session pinned to another device; re-login required", http.StatusUnauthorized)
				return
			}
			sess.LastActivity = time.Now()
			sess.ExpiresAt = time.Now().Add(defaultSessionTTL)
			s.PutHTTPSession(sess)
			u = s.GetUserByID(sess.UserID)
		}
		if u == nil {
			u = s.GetUserByID(token)
		}
		if u == nil {
			jsonError(w, "Invalid token", http.StatusUnauthorized)
			return
		}
		next(w, r, u)
	}
}

func adminRequired(s *store.Store, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" {
			jsonError(w, "Authorization required", http.StatusUnauthorized)
			return
		}
		var u *store.User
		if sess := s.GetHTTPSessionByToken(token); sess != nil {
			u = s.GetUserByID(sess.UserID)
		}
		if u == nil {
			u = s.GetUserByID(token)
		}
		if u == nil || (!strings.Contains(u.Roles, "admin") && !strings.Contains(u.Roles, "owner")) {
			jsonError(w, "Admin access required", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

func handleGetMe(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		resp := map[string]interface{}{
			"id": u.ID, "username": u.Username, "email": u.Email,
			"roles": u.Roles, "plan": u.Plan, "avatarUrl": u.AvatarURL,
			"status": u.Status, "about": u.About, "blocked": u.Blocked,
			"emailVerified": u.EmailVerified, "hasCloudPassword": u.CloudPasswordHash != "",
		}
		if sess := s.GetHTTPSessionByToken(token); sess != nil {
			resp["sessionExpiresAt"] = sess.ExpiresAt
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func handleListSessions(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		currentToken := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		list := s.ListHTTPSessionsForUser(u.ID)
		out := make([]map[string]interface{}, 0, len(list))
		for _, sess := range list {
			current := s.GetHTTPSessionByToken(currentToken) != nil && sess.Token == currentToken
			out = append(out, map[string]interface{}{
				"deviceId": sess.DeviceID, "ip": sess.IP, "lastActivity": sess.LastActivity,
				"expiresAt": sess.ExpiresAt, "current": current,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"sessions": out})
	}
}

func handleTerminateOtherSessions(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		currentToken := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		s.DeleteHTTPSessionsForUserExcept(u.ID, currentToken)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "message": "All other sessions terminated"})
	}
}

func handleLoginEvents(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, _ *http.Request, u *store.User) {
		events := s.GetLoginEvents(u.ID)
		list := make([]map[string]interface{}, 0, len(events))
		for i := len(events) - 1; i >= 0; i-- {
			ev := events[i]
			list = append(list, map[string]interface{}{
				"deviceId": ev.DeviceID, "ip": ev.IP, "city": ev.City, "createdAt": ev.CreatedAt,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"events": list})
	}
}

func handleProtection(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, _ *http.Request, u *store.User) {
		score := 0
		if u.PassHash != "" {
			score += 25
		}
		if u.Email != "" {
			score += 15
		}
		if u.EmailVerified {
			score += 20
		}
		if u.Phone != "" {
			score += 15
		}
		if u.CloudPasswordHash != "" {
			score += 25
		}
		if score > 100 {
			score = 100
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"protectionPercent": score,
			"hasPassword": u.PassHash != "", "emailVerified": u.EmailVerified,
			"hasCloudPassword": u.CloudPasswordHash != "", "hasPhone": u.Phone != "",
		})
	}
}

func handleSetCloudPassword(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
			jsonError(w, "Password required", http.StatusBadRequest)
			return
		}
		if len(req.Password) < 6 {
			jsonError(w, "Cloud password must be at least 6 characters", http.StatusBadRequest)
			return
		}
		hash, err := engine.HashPassword(req.Password)
		if err != nil {
			jsonError(w, "Server error", http.StatusInternalServerError)
			return
		}
		u.CloudPasswordHash = hash
		u.UpdatedAt = time.Now()
		s.PutUser(u)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true"})
	}
}

func handleUpdateMe(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		var req struct {
			AvatarURL string `json:"avatarUrl"`
			Status    string `json:"status"`
			About     string `json:"about"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if req.AvatarURL != "" {
			u.AvatarURL = req.AvatarURL
		}
		if req.Status != "" {
			u.Status = req.Status
		}
		u.About = req.About
		u.UpdatedAt = time.Now()
		s.PutUser(u)
		userResponse(w, u, http.StatusOK)
	}
}

var maintenanceActive bool
var maintenanceMessage string
var maintenanceTimestamp string
var maintenanceID string

func handleMaintenanceStatus(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"isActive":   maintenanceActive,
			"message":    maintenanceMessage,
			"timestamp":  maintenanceTimestamp,
			"id":         maintenanceID,
		})
	}
}

func handleMaintenanceOn(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Timestamp string `json:"timestamp"`
			Message   string `json:"message"`
			SendEmail bool   `json:"sendEmail"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		maintenanceActive = true
		maintenanceMessage = req.Message
		maintenanceTimestamp = req.Timestamp
		maintenanceID = strconv.FormatInt(time.Now().UnixMilli(), 10)
		if req.SendEmail {
			for _, u := range s.ListUsers() {
				if u.Email == "" {
					continue
				}
				_ = email.SendMaintenanceNotification(u.Email, u.Username, maintenanceTimestamp, maintenanceMessage)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Maintenance activated", "id": maintenanceID})
	}
}

func handleMaintenanceOff(w http.ResponseWriter, r *http.Request) {
	maintenanceActive = false
	maintenanceMessage = ""
	maintenanceTimestamp = ""
	maintenanceID = ""
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "message": "Maintenance disabled"})
}

func handleAdminSendEmail(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID     string `json:"userId"`
			Message    string `json:"message"`
			ActionText string `json:"actionText"`
			ActionLink string `json:"actionLink"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" || req.Message == "" {
			jsonError(w, "userId and message required", http.StatusBadRequest)
			return
		}
		u := s.GetUserByID(req.UserID)
		if u == nil {
			jsonError(w, "User not found", http.StatusNotFound)
			return
		}
		if u.Email == "" {
			jsonError(w, "User has no email", http.StatusBadRequest)
			return
		}
		if err := email.SendAdminMessage(u.Email, u.Username, req.Message, req.ActionText, req.ActionLink); err != nil {
			jsonError(w, "Failed to send email", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "to": u.Email})
	}
}

func handleAdminBroadcastEmail(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserIDs    []string `json:"userIds"`
			Message    string   `json:"message"`
			ActionText string   `json:"actionText"`
			ActionLink string   `json:"actionLink"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if len(req.UserIDs) == 0 {
			jsonError(w, "userIds required", http.StatusBadRequest)
			return
		}
		if req.Message == "" {
			jsonError(w, "message required", http.StatusBadRequest)
			return
		}
		var successCount, failedCount int
		var errors []string
		for _, id := range req.UserIDs {
			u := s.GetUserByID(id)
			if u == nil {
				failedCount++
				errors = append(errors, "user "+id+" not found")
				continue
			}
			if u.Email == "" {
				failedCount++
				errors = append(errors, "user "+id+" has no email")
				continue
			}
			if err := email.SendAdminMessage(u.Email, u.Username, req.Message, req.ActionText, req.ActionLink); err != nil {
				failedCount++
				errors = append(errors, err.Error())
				continue
			}
			successCount++
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true, "successCount": successCount, "failedCount": failedCount, "errors": errors,
		})
	}
}

func userResponse(w http.ResponseWriter, u *store.User, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"id": u.ID, "username": u.Username, "email": u.Email,
		"roles": u.Roles, "plan": u.Plan, "avatarUrl": u.AvatarURL,
		"status": u.Status, "about": u.About, "blocked": u.Blocked,
	})
}

var systemNotifyText string
var systemNotifyAt time.Time

func handleAdminListUsers(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		users := s.ListUsers()
		list := make([]map[string]interface{}, 0, len(users))
		for _, u := range users {
			list = append(list, map[string]interface{}{
				"id": u.ID, "username": u.Username, "email": u.Email,
				"roles": u.Roles, "plan": u.Plan, "status": u.Status,
				"blocked": u.Blocked, "createdAt": u.CreatedAt,
				"emailVerified": u.EmailVerified, "phoneVerified": u.PhoneVerified,
				"hasCloudPassword": u.CloudPasswordHash != "",
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"users": list})
	}
}

func handleAdminBlockUser(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			jsonError(w, "User ID required", http.StatusBadRequest)
			return
		}
		var req struct {
			Blocked bool `json:"blocked"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		s.SetUserBlocked(id, req.Blocked)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "id": id})
	}
}

func handleAdminNotify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}
	systemNotifyText = req.Message
	systemNotifyAt = time.Now()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true, "message": "Notification sent", "at": systemNotifyAt,
	})
}

func handleAdminBlockedIPs(g *transport.Guard) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		list := g.Blacklist.ListBanned()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"blockedIps": list})
	}
}

func handleAdminStats(s *store.Store, g *transport.Guard) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		users := s.ListUsers()
		banned := g.Blacklist.ListBanned()
		// HTTP sessions count: no direct method, approximate from store
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"usersCount":   len(users),
			"blockedIpsCount": len(banned),
		})
	}
}

func handleAdminSetPlan(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			jsonError(w, "User ID required", http.StatusBadRequest)
			return
		}
		var req struct {
			Plan string `json:"plan"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		plan := strings.ToLower(strings.TrimSpace(req.Plan))
		if plan != "free" && plan != "premium" {
			plan = "free"
		}
		u := s.GetUserByID(id)
		if u == nil {
			jsonError(w, "User not found", http.StatusNotFound)
			return
		}
		u.Plan = plan
		u.UpdatedAt = time.Now()
		s.PutUser(u)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "id": id, "plan": plan})
	}
}

func handleAdminTraffic(g *transport.Guard) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		list := g.Traffic.Last(50)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ips": list})
	}
}

func handleAdminBanIP(g *transport.Guard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			IP string `json:"ip"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		ip := strings.TrimSpace(req.IP)
		if ip == "" {
			jsonError(w, "IP required", http.StatusBadRequest)
			return
		}
		g.Blacklist.BanIP(ip)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "ip": ip})
	}
}

func handleAdminDDoSSettingsGet(g *transport.Guard) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		rate, cap, pow := g.DDOS.Get()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ratePerSec": rate, "bucketCap": cap, "powDifficulty": pow,
		})
	}
}

func handleAdminDDoSSettingsPut(g *transport.Guard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			RatePerSec    *float64 `json:"ratePerSec"`
			BucketCap     *float64 `json:"bucketCap"`
			PoWDifficulty *uint16  `json:"powDifficulty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		rate, cap, pow := g.DDOS.Get()
		if req.RatePerSec != nil && *req.RatePerSec > 0 {
			rate = *req.RatePerSec
			g.Limiter.SetRate(rate)
		}
		if req.BucketCap != nil && *req.BucketCap > 0 {
			cap = *req.BucketCap
			g.Limiter.SetCap(cap)
		}
		if req.PoWDifficulty != nil && *req.PoWDifficulty <= 4 {
			pow = *req.PoWDifficulty
		}
		g.DDOS.Set(rate, cap, pow)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true, "ratePerSec": rate, "bucketCap": cap, "powDifficulty": pow,
		})
	}
}

func handleAdminSetRole(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			jsonError(w, "User ID required", http.StatusBadRequest)
			return
		}
		var req struct {
			Role string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		role := strings.ToLower(strings.TrimSpace(req.Role))
		if role != "user" && role != "admin" && role != "owner" {
			role = "user"
		}
		u := s.GetUserByID(id)
		if u == nil {
			jsonError(w, "User not found", http.StatusNotFound)
			return
		}
		s.SetUserRole(id, role)
		u.UpdatedAt = time.Now()
		s.PutUser(u)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "id": id, "role": role})
	}
}

func handleAdminResetPassword(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			jsonError(w, "User ID required", http.StatusBadRequest)
			return
		}
		var req struct {
			TempPassword string `json:"tempPassword"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if len(req.TempPassword) < 6 {
			jsonError(w, "Password must be at least 6 characters", http.StatusBadRequest)
			return
		}
		u := s.GetUserByID(id)
		if u == nil {
			jsonError(w, "User not found", http.StatusNotFound)
			return
		}
		hash, err := engine.HashPassword(req.TempPassword)
		if err != nil {
			jsonError(w, "Server error", http.StatusInternalServerError)
			return
		}
		u.PassHash = hash
		u.UpdatedAt = time.Now()
		s.PutUser(u)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "id": id})
	}
}

func handleAdminSessions(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		list := s.ListAllHTTPSessions()
		out := make([]map[string]interface{}, 0, len(list))
		for _, sess := range list {
			out = append(out, map[string]interface{}{
				"userId": sess.UserID, "deviceId": sess.DeviceID, "ip": sess.IP,
				"lastActivity": sess.LastActivity, "expiresAt": sess.ExpiresAt,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"sessions": out})
	}
}

func handleAdminMetrics(s *store.Store, g *transport.Guard) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		users := s.ListUsers()
		banned := g.Blacklist.ListBanned()
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"usersCount":      len(users),
			"blockedIpsCount": len(banned),
			"tcpSessions":     s.TCPSessionCount(),
			"wsConnections":   atomic.LoadInt32(&activeWSConnections),
			"goroutines":      runtime.NumGoroutine(),
			"memAllocKb":      m.Alloc / 1024,
			"memSysKb":        m.Sys / 1024,
			"encryption":      "AES-256-GCM, Curve25519",
		})
	}
}

func handleNotifyStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"text": systemNotifyText, "at": systemNotifyAt,
	})
}

func handleGetContext(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, _ *http.Request, u *store.User) {
		ctx := s.GetUserContext(u.ID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"context": ctx})
	}
}

func handleSetContext(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		var req struct {
			Context string `json:"context"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		s.SetUserContext(u.ID, req.Context)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true"})
	}
}

func handleSafetyAsk(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		var req struct {
			Message string `json:"message"`
			Mode    string `json:"mode"`
			Code    string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		ctx := s.GetUserContext(u.ID)
		reply := buildSafetyReply(s, u, ctx, req.Message, req.Mode, req.Code)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"reply": reply})
	}
}

const (
	defaultContextForLev = "Меня создал Lev — я знаю его проекты: SafeGram (E2EE мессенджер, C++/Qt, Go ядро), Minecraft серверы. Расписание и планы хранятся в контексте пользователя. Могу помогать с кодом, расписанием и безопасностью."
	safetyIntro           = "Я Safety, персональный ИИ-помощник SafeGram. Создан Lev'ом. Режим: %s."
)

// buildSafetyReply формирует ответ Safety AI с учётом контекста, расписания и активных предупреждений о входах.
func buildSafetyReply(s *store.Store, u *store.User, contextJSON, message, mode, code string) string {
	name := u.Username
	if name == "" {
		name = "пользователь"
	}
	about := u.About
	if about == "" {
		about = "—"
	}
	plan := u.Plan
	if plan == "" {
		plan = "free"
	}
	memory := ""
	if strings.EqualFold(name, "lev") || strings.Contains(strings.ToLower(u.Email), "lev") {
		memory = defaultContextForLev
	} else {
		memory = "Я помощник SafeGram; меня создал Lev. Могу помогать с кодом, расписанием и безопасностью."
	}
	ctxNote := ""
	if contextJSON != "" {
		ctxNote = " Контекст пользователя (расписание, проекты): " + contextJSON + "."
	}
	// Активное предупреждение: последние входы и подозрительная активность (Session Pinning, DDoS).
	events := s.GetLoginEvents(u.ID)
	var securityNote string
	if len(events) > 0 {
		last := events[len(events)-1]
		securityNote = fmt.Sprintf(" Последний вход: %s с устройства %s.", last.IP, last.DeviceID)
		if len(events) > 1 {
			ips := make(map[string]int)
			for _, e := range events {
				ips[e.IP]++
			}
			if len(ips) > 2 {
				securityNote += " Внимание: входы с нескольких IP — убедитесь, что это вы."
			}
		}
	}
	msgLower := strings.ToLower(strings.TrimSpace(message))

	// Расписание / план на день
	if strings.Contains(msgLower, "план на день") || strings.Contains(msgLower, "расписание") || strings.Contains(msgLower, "распиши день") || strings.Contains(msgLower, "что делать") {
		scheduleReply := fmt.Sprintf("Привет, %s! Вот шаблон плана на день:\n\n1. Утро: разбор почты и приоритетов (15–30 мин).\n2. Глубокий фокус: основная задача по SafeGram или код (2–3 блока по 45 мин).\n3. Обед + короткий отдых.\n4. Вторая важная задача или код-ревью, тесты.\n5. Вечер: документация, мелкие задачи, подготовка завтрашнего дня.\n\nДедлайны лучше фиксировать в календаре. Если нужно, могу разбить по конкретным задачам.", name)
		return scheduleReply + "\n\n" + memory
	}

	// Анализ кода
	codeBlock := ""
	if code != "" {
		codeBlock = "\n\n[Анализ кода]\n"
		codeBlock += fmt.Sprintf("Фрагмент: %d символов. ", len(code))
		if strings.Contains(message, "go") || strings.Contains(message, "Go") || strings.Contains(message, "golang") {
			codeBlock += "Рекомендации для Go: используйте crypto/rand для ключей (32 байта для AES-256), проверяйте ошибки после каждого вызова, используйте staticcheck и gosec. Для больших модулей — разбейте на пакеты и добавьте тесты."
		} else {
			codeBlock += "Рекомендации: проверьте границы массивов и обработку ошибок; для крипто-ключей — только криптостойкий ГПСЧ; подключите линтеры и тесты."
		}
		if len(code) > 200 {
			codeBlock += " Разбейте длинный код на функции для читаемости."
		}
	}

	intro := fmt.Sprintf(safetyIntro, mode)
	out := intro + "\n\n" + memory + ctxNote
	if securityNote != "" {
		out += "\n\n[Безопасность]" + securityNote
	}
	out += "\n\nЗапрос: «" + message + "»."
	if codeBlock != "" {
		out += codeBlock
	} else {
		out += "\n\nКраткий ответ: готов помочь с кодом (пришли фрагмент в поле «Код»), расписанием или безопасностью. Для Lev — знаю контекст SafeGram и могу подсказать по архитектуре или тестам."
	}
	return out
}

func handleListRooms(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, _ *http.Request, u *store.User) {
		rooms := s.ListRoomsForUser(u.ID)
		list := make([]map[string]interface{}, 0, len(rooms))
		for _, r := range rooms {
			list = append(list, map[string]interface{}{
				"id": r.ID, "name": r.Name, "type": r.Type, "memberCount": len(r.MemberIDs),
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"rooms": list})
	}
}

func handleCreateRoom(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		var req struct {
			Name string   `json:"name"`
			Type string   `json:"type"`
			IDs  []string `json:"memberIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
		req.Type = strings.ToLower(strings.TrimSpace(req.Type))
		if req.Type != "group" && req.Type != "channel" {
			req.Type = "group"
		}
		roomKey := make([]byte, 32)
		if _, err := rand.Read(roomKey); err != nil {
			jsonError(w, "Server error", http.StatusInternalServerError)
			return
		}
		members := append([]string{u.ID}, req.IDs...)
		room := &store.Room{
			ID:        s.NextRoomID(),
			Name:      strings.TrimSpace(req.Name),
			Type:      req.Type,
			RoomKey:   roomKey,
			MemberIDs: members,
			OwnerID:   u.ID,
			CreatedAt: time.Now(),
		}
		if room.Name == "" {
			room.Name = "Room " + room.ID
		}
		s.PutRoom(room)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id": room.ID, "name": room.Name, "type": room.Type, "memberCount": len(room.MemberIDs),
		})
	}
}

var devStatusStart = time.Now()

func handleDevStatus(w http.ResponseWriter, _ *http.Request, _ *store.User) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"http":   "ok",
		"tcp":    "ok",
		"uptime": time.Since(devStatusStart).String(),
	})
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

