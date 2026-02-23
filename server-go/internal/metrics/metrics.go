package metrics

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var (
	requestsTotal   uint64
	requestsErrors  uint64
	requestsLatency []uint64 // 0: <100ms, 1: 100ms-500ms, 2: 500ms-1s, 3: >1s
	latencyMu       sync.Mutex
	startTime       = time.Now()
)

func init() {
	requestsLatency = make([]uint64, 4)
}

func IncRequests(status int) {
	atomic.AddUint64(&requestsTotal, 1)
	if status >= 400 {
		atomic.AddUint64(&requestsErrors, 1)
	}
}

func ObserveLatency(d time.Duration) {
	ms := d.Milliseconds()
	latencyMu.Lock()
	defer latencyMu.Unlock()
	if ms < 100 {
		requestsLatency[0]++
	} else if ms < 500 {
		requestsLatency[1]++
	} else if ms < 1000 {
		requestsLatency[2]++
	} else {
		requestsLatency[3]++
	}
}

// Handler returns Prometheus-style text metrics for GET /metrics
func Handler() string {
	total := atomic.LoadUint64(&requestsTotal)
	errors := atomic.LoadUint64(&requestsErrors)
	uptime := time.Since(startTime).Seconds()
	latencyMu.Lock()
	l0, l1, l2, l3 := requestsLatency[0], requestsLatency[1], requestsLatency[2], requestsLatency[3]
	latencyMu.Unlock()
	rps := float64(0)
	if uptime > 0 {
		rps = float64(total) / uptime
	}
	return fmt.Sprintf(`# HELP safegram_http_requests_total Total HTTP requests
# TYPE safegram_http_requests_total counter
safegram_http_requests_total %d
# HELP safegram_http_requests_errors_total Total HTTP errors (4xx/5xx)
# TYPE safegram_http_requests_errors_total counter
safegram_http_requests_errors_total %d
# HELP safegram_http_request_duration_bucket Request latency buckets (ms)
# TYPE safegram_http_request_duration_bucket counter
safegram_http_request_duration_bucket{le="100"} %d
safegram_http_request_duration_bucket{le="500"} %d
safegram_http_request_duration_bucket{le="1000"} %d
safegram_http_request_duration_bucket{le="+Inf"} %d
# HELP safegram_uptime_seconds Process uptime
# TYPE safegram_uptime_seconds gauge
safegram_uptime_seconds %f
# HELP safegram_rps Requests per second (derived)
# TYPE safegram_rps gauge
safegram_rps %f
`, total, errors, l0, l0+l1, l0+l1+l2, l0+l1+l2+l3, uptime, rps)
}
