package metrics

import (
	"strings"
	"testing"
	"time"
)

func TestMetricsHandler(t *testing.T) {
	IncRequests(200)
	IncRequests(500)
	ObserveLatency(50 * time.Millisecond)
	ObserveLatency(200 * time.Millisecond)
	out := Handler()
	if !strings.Contains(out, "safegram_http_requests_total") {
		t.Error("expected safegram_http_requests_total in output")
	}
	if !strings.Contains(out, "safegram_uptime_seconds") {
		t.Error("expected safegram_uptime_seconds in output")
	}
}
