package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/89646128494le-svg/safegram-core/internal/alerts"
	"github.com/89646128494le-svg/safegram-core/internal/email"
	"github.com/89646128494le-svg/safegram-core/internal/engine"
	"github.com/89646128494le-svg/safegram-core/internal/store"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
)

const defaultSessionTTL = 7 * 24 * time.Hour
const tempAuthTTL = 15 * time.Minute
const smsCodeTTL = 5 * time.Minute
const emailCodeTTL = 10 * time.Minute

// runHTTPAPI запускает HTTP API :8081. Используется только для выдачи токена (SafeGuard MFA: пароль → 6-значный код → облачный пароль),
// профиля, Safety AI и админки. Трафик сообщений — только бинарный (GET /ws или TCP :8080), шифрование AES-256-GCM, Curve25519.
func runHTTPAPI(s *store.Store, g *transport.Guard) {
	alerts.AlertServerStarted()
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
	mux.HandleFunc("GET /api/security/trust-score", authRequired(s, handleTrustScore(s)))
	mux.HandleFunc("PUT /api/security/cloud-password", authRequired(s, handleSetCloudPassword(s)))
	mux.HandleFunc("POST /api/safety/ask", authRequired(s, handleSafetyAsk(s, newSafetyAI(s))))
	mux.HandleFunc("GET /api/maintenance/status", handleMaintenanceStatus(s))
	mux.HandleFunc("POST /api/admin/maintenance", adminRequiredAction(s, store.ActionMaintenance, handleMaintenanceOn(s)))
	mux.HandleFunc("POST /api/admin/maintenance/disable", adminRequiredAction(s, store.ActionMaintenance, handleMaintenanceOff))
	mux.HandleFunc("GET /api/admin/users", adminRequiredAction(s, store.ActionManageUsers, handleAdminListUsers(s)))
	mux.HandleFunc("POST /api/admin/users/{id}/block", adminRequiredAction(s, store.ActionBlockUser, handleAdminBlockUser(s)))
	mux.HandleFunc("PUT /api/admin/users/{id}/plan", adminRequiredAction(s, store.ActionSetUserPlan, handleAdminSetPlan(s)))
	mux.HandleFunc("POST /api/admin/notify", adminRequiredAction(s, store.ActionManageUsers, handleAdminNotify))
	mux.HandleFunc("POST /api/admin/send-email", adminRequiredAction(s, store.ActionManageUsers, handleAdminSendEmail(s)))
	mux.HandleFunc("POST /api/admin/broadcast-email", adminRequiredAction(s, store.ActionManageUsers, handleAdminBroadcastEmail(s)))
	mux.HandleFunc("GET /api/admin/blocked-ips", adminRequiredAction(s, store.ActionBanIP, handleAdminBlockedIPs(g)))
	mux.HandleFunc("GET /api/admin/stats", adminRequired(s, handleAdminStats(s, g)))
	mux.HandleFunc("GET /api/admin/traffic", adminRequiredAction(s, store.ActionViewTraffic, handleAdminTraffic(g)))
	mux.HandleFunc("POST /api/admin/ban-ip", adminRequiredAction(s, store.ActionBanIP, handleAdminBanIP(s, g)))
	mux.HandleFunc("GET /api/admin/ddos-settings", adminRequiredAction(s, store.ActionViewTraffic, handleAdminDDoSSettingsGet(g)))
	mux.HandleFunc("PUT /api/admin/ddos-settings", adminRequiredAction(s, store.ActionViewTraffic, handleAdminDDoSSettingsPut(g)))
	mux.HandleFunc("PUT /api/admin/users/{id}/role", adminRequiredAction(s, store.ActionSetUserRole, handleAdminSetRole(s)))
	mux.HandleFunc("POST /api/admin/users/{id}/reset-password", adminRequiredAction(s, store.ActionManageUsers, handleAdminResetPassword(s)))
	mux.HandleFunc("GET /api/admin/metrics", adminRequiredAction(s, store.ActionViewTraffic, handleAdminMetrics(s, g)))
	mux.HandleFunc("GET /api/admin/sessions", adminRequiredAction(s, store.ActionViewSessions, handleAdminSessions(s)))
	mux.HandleFunc("GET /api/admin/audit-logs", ownerOnly(s, handleAuditLogs(s)))
	mux.HandleFunc("GET /api/admin/audit-logs/stream", ownerOnly(s, handleAuditLogsStream(s)))
	mux.HandleFunc("GET /api/admin/live-stats", ownerOnly(s, handleLiveStats(s)))
	mux.HandleFunc("GET /api/admin/anomaly-score", ownerOnly(s, handleAnomalyScore(s)))
	mux.HandleFunc("POST /api/admin/nn/retrain", ownerOnly(s, handleNNRetrain(s)))
	mux.HandleFunc("POST /api/admin/test-ddos", ownerOnly(s, handleTestDDoS(s)))
	go runAnomalyGuard(s)
	go runMonitoringBot(s)
	mux.HandleFunc("GET /api/notify/status", handleNotifyStatus)
	mux.HandleFunc("GET /api/rooms", authRequired(s, handleListRooms(s)))
	mux.HandleFunc("POST /api/rooms", authRequired(s, handleCreateRoom(s)))
	mux.HandleFunc("GET /api/dev/status", authRequired(s, handleDevStatus))
	mux.HandleFunc("GET /ws", handleWebSocket(s))
	httpAddr := ":8081"
	if p := os.Getenv("HTTP_PORT"); p != "" {
		httpAddr = ":" + strings.TrimPrefix(p, ":")
	}
	server := &http.Server{Addr: httpAddr, Handler: cors(mux)}
	log.Printf("HTTP API on %s", httpAddr)
	_ = server.ListenAndServe()
}

// validUserID допускает только безопасные ID (алфавит, цифры, дефис, подчёркивание; 1–128 символов).
func validUserID(id string) bool {
	if len(id) == 0 || len(id) > 128 {
		return false
	}
	for _, c := range id {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			continue
		}
		return false
	}
	return true
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
	origins := allowedOrigins()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && origins != nil {
			if _, ok := origins[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
		} else if origins == nil {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func allowedOrigins() map[string]struct{} {
	s := os.Getenv("ALLOWED_ORIGINS")
	if s == "" {
		return nil
	}
	m := make(map[string]struct{})
	for _, o := range strings.Split(s, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			m[o] = struct{}{}
		}
	}
	if len(m) == 0 {
		return nil
	}
	return m
}

func handleRegister(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username          string `json:"username"`
			Password          string `json:"password"`
			Email             string `json:"email"`
			Phone             string `json:"phone"`
			IdentityPublicKey string `json:"identity_public_key"` // base64 Ed25519 32 bytes — wallet-style; опционально
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
		var identityPub []byte
		if req.IdentityPublicKey != "" {
			identityPub, _ = base64.StdEncoding.DecodeString(req.IdentityPublicKey)
			if len(identityPub) != 32 {
				identityPub = nil
			}
		}
		now := time.Now()
		u := &store.User{
			ID:                s.NextUserID(),
			Username:          req.Username,
			Email:             strings.TrimSpace(req.Email),
			Phone:             strings.TrimSpace(req.Phone),
			PassHash:          hash,
			IdentityPublicKey: identityPub,
			Roles:             "user",
			Plan:              "free",
			Status:            "offline",
			About:             "",
			EmailVerified:     false,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		s.PutUser(u)
		s.AppendLog(store.AdminLog{
			Timestamp:  now,
			AdminID:    "system",
			ActionType: store.AdminActionRegistration,
			TargetID:   u.ID,
			TargetName: u.Username,
			Reason:     "new user",
			Severity:   store.SeverityInfo,
		})
		userResponse(w, u, http.StatusCreated)
	}
}

func handleLogin(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
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
			jsonError(w, "Invalid username or password", http.StatusUnauthorized)
			return
		}
		if u.Blocked {
			jsonError(w, "Account blocked", http.StatusForbidden)
			return
		}
		if err := engine.VerifyPassword(u.PassHash, req.Password); err != nil {
			jsonError(w, "Invalid username or password", http.StatusUnauthorized)
			return
		}
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
	u := s.GetUserByID(userID)
	name := ""
	if u != nil {
		name = u.Username
	}
	s.AppendLog(store.AdminLog{
		Timestamp:  now,
		AdminID:    "system",
		ActionType: store.AdminActionHandshake,
		TargetID:   userID,
		TargetName: name,
		Reason:     "session",
		Severity:   store.SeverityInfo,
		Extra:      ip,
	})
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
			Code      string `json:"code"`
			DeviceID  string `json:"deviceId"`
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
			Code      string `json:"code"`
			DeviceID  string `json:"deviceId"`
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
			TempToken     string `json:"tempToken"`
			CloudPassword string `json:"cloudPassword"`
			DeviceID      string `json:"deviceId"`
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
	store.NormalizeUserRole(u)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token, "sessionExpiresAt": sess.ExpiresAt, "deviceId": sess.DeviceID,
		"id": u.ID, "username": u.Username, "email": u.Email,
		"roles": u.Roles, "role": u.Role, "plan": u.Plan, "avatarUrl": u.AvatarURL,
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
			jsonError(w, "Invalid token", http.StatusUnauthorized)
			return
		}
		if u.Blocked {
			jsonError(w, "Account blocked", http.StatusForbidden)
			return
		}
		next(w, r, u)
	}
}

func getAdminUser(s *store.Store, r *http.Request) *store.User {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == "" {
		return nil
	}
	var u *store.User
	if sess := s.GetHTTPSessionByToken(token); sess != nil && time.Now().Before(sess.ExpiresAt) {
		u = s.GetUserByID(sess.UserID)
	}
	if u == nil {
		return nil
	}
	if u.Blocked {
		return nil
	}
	return u
}

func adminRequired(s *store.Store, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := getAdminUser(s, r)
		if u == nil {
			jsonError(w, "Authorization required", http.StatusUnauthorized)
			return
		}
		top := store.TopRole(u.Roles)
		allowed := top == store.RoleOwner || top == store.RoleAdmin || top == store.RoleGuardian ||
			top == store.RoleModerator || top == store.RoleSupport
		if !allowed {
			jsonError(w, "Admin access required", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

func adminRequiredAction(s *store.Store, action string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := getAdminUser(s, r)
		if u == nil {
			jsonError(w, "Authorization required", http.StatusUnauthorized)
			return
		}
		if !store.HasPermission(u.Roles, u.ID, u.Username, action) {
			ip := getClientIP(r)
			s.AppendLog(store.AdminLog{
				Timestamp:  time.Now(),
				AdminID:    u.ID,
				AdminName:  u.Username,
				ActionType: store.AdminActionFailedAdminLogin,
				Reason:     "forbidden",
				Severity:   store.SeverityCritical,
				Extra:      ip,
			})
			jsonError(w, "Forbidden", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

func ownerOnly(s *store.Store, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := getAdminUser(s, r)
		if u == nil {
			jsonError(w, "Authorization required", http.StatusUnauthorized)
			return
		}
		if !store.IsSystemOwner(u.ID, u.Username) {
			jsonError(w, "Owner only", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

const maxAuditLogLimit = 1000

func handleAuditLogs(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 500
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= maxAuditLogLimit {
				limit = n
			}
		}
		logs, err := s.ReadLogs(limit)
		if err != nil {
			jsonError(w, "Failed to read logs", http.StatusInternalServerError)
			return
		}
		if r.URL.Query().Get("export") == "1" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Header().Set("Content-Disposition", "attachment; filename=safegram-audit-"+time.Now().Format("2006-01-02")+".txt")
			for _, log := range logs {
				ts := log.Timestamp.Format("2006-01-02 15:04:05")
				line := ts + " [" + log.Severity + "] " + log.ActionType + " admin=" + log.AdminID + " target=" + log.TargetID + " " + log.Reason
				if log.Extra != "" {
					line += " " + log.Extra
				}
				line += "\n"
				w.Write([]byte(line))
			}
			return
		}
		w.Header().Set("Content-Type", "application/json")
		out := make([]map[string]interface{}, 0, len(logs))
		for _, log := range logs {
			out = append(out, map[string]interface{}{
				"timestamp":  log.Timestamp.UnixMilli(),
				"adminId":    log.AdminID,
				"adminName":  log.AdminName,
				"actionType": log.ActionType,
				"targetId":   log.TargetID,
				"targetName": log.TargetName,
				"reason":     log.Reason,
				"severity":   log.Severity,
				"extra":      log.Extra,
			})
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"logs": out})
	}
}

func handleAuditLogsStream(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ch, closeFn := store.SubscribeAudit()
		defer closeFn()
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		if fl, ok := w.(http.Flusher); ok {
			fl.Flush()
		}
		for {
			select {
			case <-r.Context().Done():
				return
			case entries, ok := <-ch:
				if !ok {
					return
				}
				for _, log := range entries {
					ev := map[string]interface{}{
						"timestamp":  log.Timestamp.UnixMilli(),
						"adminId":    log.AdminID,
						"adminName":  log.AdminName,
						"actionType": log.ActionType,
						"targetId":   log.TargetID,
						"targetName": log.TargetName,
						"reason":     log.Reason,
						"severity":   log.Severity,
						"extra":      log.Extra,
					}
					data, _ := json.Marshal(ev)
					w.Write([]byte("data: "))
					w.Write(data)
					w.Write([]byte("\n\n"))
					if fl, ok := w.(http.Flusher); ok {
						fl.Flush()
					}
				}
			}
		}
	}
}

func handleLiveStats(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		st := s.GetLiveStats()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"goroutines": st.Goroutines,
			"memoryMB":   st.MemoryMB,
			"sessions":   st.Sessions,
			"at":         st.At.UnixMilli(),
		})
	}
}

func handleAnomalyScore(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		logs, _ := store.ReadAuditLog(50)
		ex := engine.DefaultAnomalyScorer().ScoreExplain(logs)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ex)
	}
}

func runAnomalyGuard(s *store.Store) {
	threshold := 0.75
	if v := os.Getenv("ANOMALY_ALERT_THRESHOLD"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f >= 0 && f <= 1 {
			threshold = f
		}
	}
	ticker := time.NewTicker(3 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		logs, err := store.ReadAuditLog(100)
		if err != nil || len(logs) == 0 {
			continue
		}
		engine.DefaultAnomalyScorer().CheckAndAlert(logs, threshold, alerts.SendAdminAlert)
	}
}

func runMonitoringBot(s *store.Store) {
	interval := time.Hour
	if v := os.Getenv("MONITORING_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d >= time.Minute {
			interval = d
		}
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		logs, err := store.ReadAuditLog(50)
		if err != nil {
			continue
		}
		ex := engine.DefaultAnomalyScorer().ScoreExplain(logs)
		status := "работает"
		if ex.Severity == engine.SeverityCritical {
			status = "внимание: высокая аномальность"
		} else if ex.Severity == engine.SeverityHigh {
			status = "повышенная активность"
		}
		alerts.SendMonitoringReport(ex.Score, len(logs), status)
	}
}

func handleNNRetrain(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		path := os.Getenv("ANOMALY_MODEL_PATH")
		if path == "" {
			path = "models/anomaly_mlp.json"
		}
		engine.RetrainAndSetDefault(path)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "message": "Модель переобучена и сохранена."})
	}
}

func handleTestDDoS(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		logs, _ := store.ReadAuditLog(50)
		testLogs := engine.AppendTestAnomalyLogs(logs)
		ex := engine.DefaultAnomalyScorer().ScoreExplain(testLogs)
		alerts.SendAdminAlert("🛡️ <b>Тест защиты SafeGram</b>\nНейросеть сработала. Score: " + strconv.FormatFloat(ex.Score*100, 'f', 0, 64) + "%. Мониторинг активен.")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok": true, "anomalyScore": ex.Score, "severity": ex.Severity,
			"message": "Тест выполнен. Проверь Telegram.",
		})
	}
}

func handleGetMe(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, r *http.Request, u *store.User) {
		store.NormalizeUserRole(u)
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		resp := map[string]interface{}{
			"id": u.ID, "username": u.Username, "email": u.Email,
			"roles": u.Roles, "role": u.Role, "plan": u.Plan, "avatarUrl": u.AvatarURL,
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
			"hasPassword":       u.PassHash != "", "emailVerified": u.EmailVerified,
			"hasCloudPassword": u.CloudPasswordHash != "", "hasPhone": u.Phone != "",
		})
	}
}

func handleTrustScore(s *store.Store) func(http.ResponseWriter, *http.Request, *store.User) {
	return func(w http.ResponseWriter, _ *http.Request, u *store.User) {
		identityVerified := u != nil && len(u.IdentityPublicKey) == 32
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"trustScore":        map[string]interface{}{"identityVerified": identityVerified, "sessionVerified": true},
			"identityVerified":  identityVerified,
			"sessionVerified":   true,
			"hasIdentityPubKey": identityVerified,
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
			"isActive":  maintenanceActive,
			"message":   maintenanceMessage,
			"timestamp": maintenanceTimestamp,
			"id":        maintenanceID,
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
	store.NormalizeUserRole(u)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"id": u.ID, "username": u.Username, "email": u.Email,
		"roles": u.Roles, "role": u.Role, "plan": u.Plan, "avatarUrl": u.AvatarURL,
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
		if id == "" || !validUserID(id) {
			jsonError(w, "Invalid user ID", http.StatusBadRequest)
			return
		}
		target := s.GetUserByID(id)
		if target != nil && store.IsSystemOwner(target.ID, target.Username) {
			jsonError(w, "Cannot block system owner", http.StatusForbidden)
			return
		}
		var req struct {
			Blocked bool   `json:"blocked"`
			Reason  string `json:"reason"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		s.SetUserBlocked(id, req.Blocked)
		caller := getAdminUser(s, r)
		if caller != nil {
			reason := "block"
			if !req.Blocked {
				reason = "unblock"
			}
			s.AppendLog(store.AdminLog{
				Timestamp:  time.Now(),
				AdminID:    caller.ID,
				AdminName:  caller.Username,
				ActionType: store.AdminActionBan,
				TargetID:   id,
				TargetName: func() string {
					if target != nil {
						return target.Username
					}
					return ""
				}(),
				Reason:   reason,
				Severity: store.SeverityModeration,
			})
		}
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
			"usersCount":      len(users),
			"blockedIpsCount": len(banned),
		})
	}
}

func handleAdminSetPlan(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" || !validUserID(id) {
			jsonError(w, "Invalid user ID", http.StatusBadRequest)
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
		caller := getAdminUser(s, r)
		if caller != nil {
			s.AppendLog(store.AdminLog{
				Timestamp:  time.Now(),
				AdminID:    caller.ID,
				AdminName:  caller.Username,
				ActionType: store.AdminActionConfigChange,
				TargetID:   id,
				TargetName: u.Username,
				Reason:     "plan=" + plan,
				Severity:   store.SeverityModeration,
			})
		}
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

func handleAdminBanIP(s *store.Store, g *transport.Guard) http.HandlerFunc {
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
		caller := getAdminUser(s, r)
		if caller != nil {
			s.AppendLog(store.AdminLog{
				Timestamp:  time.Now(),
				AdminID:    caller.ID,
				AdminName:  caller.Username,
				ActionType: store.AdminActionAntiDDoS,
				TargetID:   ip,
				Reason:     "ban IP",
				Severity:   store.SeverityCritical,
			})
			alerts.SendAdminAlert("🛡️ IP <code>" + ip + "</code> заблокирован админом " + caller.Username + ".")
		}
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
		if id == "" || !validUserID(id) {
			jsonError(w, "Invalid user ID", http.StatusBadRequest)
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
		if role != "user" && role != "admin" && role != "owner" && role != "guardian" && role != "moderator" && role != "support" {
			role = "user"
		}
		u := s.GetUserByID(id)
		if u == nil {
			jsonError(w, "User not found", http.StatusNotFound)
			return
		}
		if store.IsSystemOwner(u.ID, u.Username) {
			jsonError(w, "Cannot change system owner role", http.StatusForbidden)
			return
		}
		caller := getAdminUser(s, r)
		if role == store.RoleOwner {
			if caller == nil || !store.IsSystemOwner(caller.ID, caller.Username) {
				jsonError(w, "Only system owner can assign owner role", http.StatusForbidden)
				return
			}
		}
		s.SetUserRole(id, role)
		u.UpdatedAt = time.Now()
		s.PutUser(u)
		if caller != nil {
			sev := store.SeverityModeration
			reason := "role " + role
			if role == store.RoleAdmin && !store.IsSystemOwner(caller.ID, caller.Username) {
				sev = store.SeverityCritical
				reason = "Лев, " + caller.Username + " выдал роль админа пользователю " + u.Username
				alerts.AlertPermissionAttempt(caller.Username, u.Username, "выдать роль админа")
			}
			s.AppendLog(store.AdminLog{
				Timestamp:  time.Now(),
				AdminID:    caller.ID,
				AdminName:  caller.Username,
				ActionType: store.AdminActionRoleChange,
				TargetID:   id,
				TargetName: u.Username,
				Reason:     reason,
				Severity:   sev,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"success": "true", "id": id, "role": role})
	}
}

func handleAdminResetPassword(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" || !validUserID(id) {
			jsonError(w, "Invalid user ID", http.StatusBadRequest)
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

func newSafetyAI(s *store.Store) *engine.SafetyAI {
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		return nil
	}
	baseDir := os.Getenv("SAFEGRAM_ROOT")
	if baseDir == "" {
		baseDir, _ = os.Getwd()
	}
	return &engine.SafetyAI{
		APIKey:        key,
		Store:         s,
		KnowledgeBase: engine.IndexKnowledge(baseDir),
		SendAlert:     alerts.SendAdminAlert,
		GetStats: func() (goroutines int, memoryMB float64, users int) {
			st := s.GetLiveStats()
			return st.Goroutines, st.MemoryMB, st.Sessions
		},
	}
}

func handleSafetyAsk(s *store.Store, ai *engine.SafetyAI) func(http.ResponseWriter, *http.Request, *store.User) {
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
		var reply string
		var actionPerformed []engine.ExecutedCall
		if ai != nil {
			var err error
			reply, actionPerformed, err = ai.Ask(u, req.Message, req.Mode)
			if err != nil {
				reply = "Safety временно недоступен. " + err.Error()
			}
		}
		if reply == "" {
			ctx := s.GetUserContext(u.ID)
			reply = buildSafetyReply(s, u, ctx, req.Message, req.Mode, req.Code)
		}
		w.Header().Set("Content-Type", "application/json")
		out := map[string]interface{}{"reply": reply}
		if len(actionPerformed) > 0 {
			out["actionPerformed"] = actionPerformed
		}
		_ = json.NewEncoder(w).Encode(out)
	}
}

const (
	defaultContextForLev = "Меня создал Lev — я знаю его проекты: SafeGram (E2EE мессенджер, C++/Qt, Go ядро), Minecraft серверы. Расписание и планы хранятся в контексте пользователя. Могу помогать с кодом, расписанием и безопасностью."
	safetyIntro          = "Я Safety, персональный ИИ-помощник SafeGram. Создан Lev'ом. Режим: %s."
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
