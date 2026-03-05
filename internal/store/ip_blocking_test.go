package store

import "testing"

func TestFailedLoginDoesNotAutoBlockIP(t *testing.T) {
	s := NewStore()
	ip := "203.0.113.10"

	for i := 0; i < 20; i++ {
		s.RecordFailedLogin(ip)
	}

	if s.IsIPBlocked(ip) {
		t.Fatalf("expected IP %s to never auto-block", ip)
	}

	s.ResetFailedLogin(ip)
	if s.IsIPBlocked(ip) {
		t.Fatalf("expected IP %s to stay unblocked after reset", ip)
	}
}
