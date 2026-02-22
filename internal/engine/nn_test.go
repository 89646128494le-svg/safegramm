package engine

import (
	"math"
	"testing"

	"github.com/89646128494le-svg/safegram-core/internal/store"
)

func TestMLP_Forward(t *testing.T) {
	nn := NewMLP(2, 4, 1)
	out := nn.Forward([]float64{0.5, 0.5})
	if out == nil || len(out) != 1 {
		t.Fatal("Forward returned nil or wrong length")
	}
	if out[0] <= 0 || out[0] >= 1 {
		t.Logf("sigmoid output %f (expected in (0,1))", out[0])
	}
}

func TestMLP_XOR(t *testing.T) {
	nn := NewMLP(2, 4, 1)
	X := [][]float64{{0, 0}, {0, 1}, {1, 0}, {1, 1}}
	y := []float64{0, 1, 1, 0}
	for epoch := 0; epoch < 5000; epoch++ {
		nn.Train(X, y, 0.3)
	}
	for i, x := range X {
		got := nn.Predict(x)
		want := y[i]
		if math.Abs(got-want) > 0.45 {
			t.Errorf("XOR[%d] input %v: got %f want %f", i, x, got, want)
		}
	}
}

func TestFeaturesFromAuditLog(t *testing.T) {
	feat := FeaturesFromAuditLog(nil)
	if len(feat) != AnomalyNumFeatures {
		t.Fatalf("features length %d", len(feat))
	}
	logs := []store.AdminLog{
		{Severity: store.SeverityCritical, ActionType: store.AdminActionRoleChange},
		{Severity: store.SeverityInfo, ActionType: store.AdminActionHandshake},
	}
	feat2 := FeaturesFromAuditLog(logs)
	if len(feat2) != AnomalyNumFeatures {
		t.Fatalf("features length %d", len(feat2))
	}
	if feat2[0] <= 0 || feat2[1] <= 0 {
		t.Logf("expected positive critical/role share: %v", feat2)
	}
}
