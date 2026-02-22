// Аномальность по логам: признаки из admin_audit и оценка через нейросеть. Защита пользователей через раннее обнаружение угроз.
package engine

import (
	"encoding/json"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/89646128494le-svg/safegram-core/internal/store"
)

const (
	AnomalyNumFeatures = 10
)

// Имена признаков для объяснения срабатывания (порядок как в FeaturesFromAuditLog).
var AnomalyFeatureNames = [AnomalyNumFeatures]string{
	"critical_share", "role_change_share", "antiddos_share", "failed_login_share", "moderation_share",
	"volume", "unique_admins", "ban_share", "config_share", "restart_share",
}

// FeaturesFromAuditLog превращает последние записи лога в вектор признаков [0..1].
func FeaturesFromAuditLog(logs []store.AdminLog) []float64 {
	out := make([]float64, AnomalyNumFeatures)
	n := float64(len(logs))
	if n == 0 {
		return out
	}
	admins := make(map[string]bool)
	for _, l := range logs {
		if l.Severity == store.SeverityCritical {
			out[0]++
		}
		if l.ActionType == store.AdminActionRoleChange {
			out[1]++
		}
		if l.ActionType == store.AdminActionAntiDDoS {
			out[2]++
		}
		if l.ActionType == store.AdminActionFailedAdminLogin {
			out[3]++
		}
		if l.Severity == store.SeverityModeration {
			out[4]++
		}
		if l.AdminID != "" {
			admins[l.AdminID] = true
		}
		if l.ActionType == store.AdminActionBan {
			out[7]++
		}
		if l.ActionType == store.AdminActionConfigChange {
			out[8]++
		}
		if l.ActionType == store.AdminActionServerRestart {
			out[9]++
		}
	}
	for i := 0; i < 5; i++ {
		out[i] /= n
		if out[i] > 1 {
			out[i] = 1
		}
	}
	out[5] = math.Log(1+n) / 5
	if out[5] > 1 {
		out[5] = 1
	}
	out[6] = float64(len(admins)) / math.Max(n, 1)
	if out[6] > 1 {
		out[6] = 1
	}
	for i := 7; i < AnomalyNumFeatures; i++ {
		out[i] /= n
		if out[i] > 1 {
			out[i] = 1
		}
	}
	return out
}

var (
	defaultScorer   *AnomalyScorer
	defaultScorerMu sync.Mutex
)

// AnomalyScorer оценивает аномальность по вектору признаков (0 = норма, 1 = подозрительно). Защита пользователей через раннее обнаружение атак.
type AnomalyScorer struct {
	mlp *MLP
}

// NewAnomalyScorer создаёт скорер с сетью 10 -> 12 -> 1 и обучает на синтетических данных.
func NewAnomalyScorer() *AnomalyScorer {
	mlp := NewMLP(AnomalyNumFeatures, 12, 1)
	trainSynthetic(mlp)
	return &AnomalyScorer{mlp: mlp}
}

func trainSynthetic(mlp *MLP) {
	var X [][]float64
	var y []float64
	// Норма: мало критичных событий
	for i := 0; i < 120; i++ {
		x := make([]float64, AnomalyNumFeatures)
		x[0], x[1], x[2], x[3] = randFloat(0, 0.08), randFloat(0, 0.05), randFloat(0, 0.08), randFloat(0, 0.05)
		x[4], x[5] = randFloat(0, 0.25), randFloat(0.1, 0.5)
		x[6], x[7], x[8], x[9] = randFloat(0.1, 0.5), randFloat(0, 0.1), randFloat(0, 0.05), randFloat(0, 0.02)
		X = append(X, x)
		y = append(y, 0)
	}
	// Аномалия: много critical / смен ролей / DDoS / неудачных входов
	for i := 0; i < 120; i++ {
		x := make([]float64, AnomalyNumFeatures)
		x[0], x[1], x[2], x[3] = randFloat(0.15, 0.95), randFloat(0.1, 0.8), randFloat(0.1, 0.9), randFloat(0.05, 0.7)
		x[4], x[5] = randFloat(0.2, 0.8), randFloat(0.4, 1.0)
		x[6], x[7], x[8], x[9] = randFloat(0.3, 1.0), randFloat(0.1, 0.6), randFloat(0.05, 0.4), randFloat(0, 0.3)
		X = append(X, x)
		y = append(y, 1)
	}
	for epoch := 0; epoch < 350; epoch++ {
		_ = mlp.Train(X, y, 0.04)
	}
}

func randFloat(lo, hi float64) float64 {
	return lo + (hi-lo)*rand.Float64()
}

// Score возвращает оценку аномальности по логам (0..1).
func (s *AnomalyScorer) Score(logs []store.AdminLog) float64 {
	if s == nil || s.mlp == nil {
		return 0
	}
	feat := FeaturesFromAuditLog(logs)
	return s.mlp.Predict(feat)
}

// AnomalySeverity — уровень угрозы для пользователей.
const (
	SeverityLow      = "low"      // < 0.35
	SeverityMedium   = "medium"   // 0.35..0.6
	SeverityHigh     = "high"     // 0.6..0.85
	SeverityCritical = "critical" // >= 0.85
)

// SeverityLevel возвращает уровень угрозы по score (0..1).
func SeverityLevel(score float64) string {
	switch {
	case score >= 0.85:
		return SeverityCritical
	case score >= 0.6:
		return SeverityHigh
	case score >= 0.35:
		return SeverityMedium
	default:
		return SeverityLow
	}
}

// ExplainResult — результат оценки с объяснением (какие признаки сильнее всего повлияли).
type ExplainResult struct {
	Score    float64  `json:"score"`
	Severity string   `json:"severity"`
	TopReasons []string `json:"topReasons"`
}

// ScoreExplain возвращает оценку, уровень угрозы и топ-3 признака, повышающих аномальность.
func (s *AnomalyScorer) ScoreExplain(logs []store.AdminLog) ExplainResult {
	out := ExplainResult{Severity: SeverityLow}
	if s == nil || s.mlp == nil {
		return out
	}
	feat := FeaturesFromAuditLog(logs)
	score := s.mlp.Predict(feat)
	out.Score = score
	out.Severity = SeverityLevel(score)
	grad := s.mlp.GradientToInput([]float64{1.0})
	if len(grad) != AnomalyNumFeatures {
		return out
	}
	type idxVal struct {
		i   int
		val float64
	}
	var contrib []idxVal
	for i := 0; i < AnomalyNumFeatures; i++ {
		contrib = append(contrib, idxVal{i, grad[i] * feat[i]})
	}
	sort.Slice(contrib, func(a, b int) bool { return contrib[a].val > contrib[b].val })
	for i := 0; i < 3 && i < len(contrib); i++ {
		if contrib[i].val > 0 {
			out.TopReasons = append(out.TopReasons, AnomalyFeatureNames[contrib[i].i]+"="+strconv.FormatFloat(feat[contrib[i].i], 'f', 2, 64))
		}
	}
	return out
}

// CheckAndAlert проверяет логи, при score >= threshold отправляет алерт владельцу (защита пользователей).
func (s *AnomalyScorer) CheckAndAlert(logs []store.AdminLog, threshold float64, sendAlert func(string)) {
	if s == nil || sendAlert == nil || len(logs) == 0 {
		return
	}
	ex := s.ScoreExplain(logs)
	if ex.Score < threshold {
		return
	}
	msg := "🛡️ Safety NN: аномалия в логах — " + ex.Severity + " (" + strconv.FormatFloat(ex.Score*100, 'f', 0, 64) + "%). "
	if len(ex.TopReasons) > 0 {
		msg += "Причины: " + strings.Join(ex.TopReasons, ", ") + ". Рекомендуется проверить админ-панель."
	}
	sendAlert(msg)
}

// mlpState для сохранения/загрузки весов.
type mlpState struct {
	In, Hidden, Out int
	W1              []float64
	B1              []float64
	W2              []float64
	B2              []float64
}

// Save сохраняет веса модели в path (для повторного использования без переобучения).
func (s *AnomalyScorer) Save(path string) error {
	if s == nil || s.mlp == nil {
		return nil
	}
	nn := s.mlp
	st := mlpState{
		In: nn.In, Hidden: nn.Hidden, Out: nn.Out,
		W1: nn.W1.Data, B1: nn.B1, W2: nn.W2.Data, B2: nn.B2,
	}
	dir := filepath.Dir(path)
	if dir != "" {
		_ = os.MkdirAll(dir, 0750)
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(st)
}

// LoadAnomalyScorer загружает скорер из файла. Если файла нет — создаёт новый, обучает и сохраняет.
func LoadAnomalyScorer(path string) *AnomalyScorer {
	f, err := os.Open(path)
	if err != nil {
		sc := NewAnomalyScorer()
		_ = sc.Save(path)
		return sc
	}
	defer f.Close()
	var st mlpState
	if json.NewDecoder(f).Decode(&st) != nil {
		sc := NewAnomalyScorer()
		_ = sc.Save(path)
		return sc
	}
	if st.In != AnomalyNumFeatures || st.Out != 1 {
		sc := NewAnomalyScorer()
		_ = sc.Save(path)
		return sc
	}
	nn := &MLP{In: st.In, Hidden: st.Hidden, Out: st.Out}
	nn.W1 = Matrix{Rows: st.Hidden, Cols: st.In, Data: st.W1}
	nn.B1 = st.B1
	nn.W2 = Matrix{Rows: st.Out, Cols: st.Hidden, Data: st.W2}
	nn.B2 = st.B2
	return &AnomalyScorer{mlp: nn}
}

// RetrainAndSetDefault переобучает модель, сохраняет в path и подменяет глобальный скорер (только для владельца).
func RetrainAndSetDefault(path string) {
	sc := NewAnomalyScorer()
	_ = sc.Save(path)
	defaultScorerMu.Lock()
	defaultScorer = sc
	defaultScorerMu.Unlock()
}

// AppendTestAnomalyLogs добавляет к копии логов синтетические «аномальные» записи (только в памяти, для теста).
func AppendTestAnomalyLogs(logs []store.AdminLog) []store.AdminLog {
	out := make([]store.AdminLog, 0, len(logs)+8)
	out = append(out, logs...)
	now := time.Now()
	for i := 0; i < 5; i++ {
		out = append(out, store.AdminLog{
			Timestamp:  now,
			ActionType: store.AdminActionAntiDDoS,
			Severity:   store.SeverityCritical,
			Reason:     "test-ddos",
		})
	}
	for i := 0; i < 3; i++ {
		out = append(out, store.AdminLog{
			Timestamp:  now,
			ActionType: store.AdminActionFailedAdminLogin,
			Severity:   store.SeverityCritical,
			Reason:     "test",
		})
	}
	return out
}

// DefaultAnomalyScorer возвращает общий скорер (ленивая инициализация). Пытается загрузить из models/anomaly_mlp.json.
func DefaultAnomalyScorer() *AnomalyScorer {
	defaultScorerMu.Lock()
	defer defaultScorerMu.Unlock()
	if defaultScorer == nil {
		path := os.Getenv("ANOMALY_MODEL_PATH")
		if path == "" {
			path = "models/anomaly_mlp.json"
		}
		defaultScorer = LoadAnomalyScorer(path)
	}
	return defaultScorer
}
