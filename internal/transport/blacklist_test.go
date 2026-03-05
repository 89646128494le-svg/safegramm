package transport

import "testing"

func TestRecordPacketViolationDoesNotAutoBanIP(t *testing.T) {
	b := NewBlacklist()
	ip := "198.51.100.24"

	for i := 0; i < 10; i++ {
		b.RecordPacketViolation(ip)
	}

	if b.IsBlacklisted(ip) {
		t.Fatalf("expected IP %s to never be auto-banned from packet violations", ip)
	}
}

func TestBanIPStillWorksForAdminFlow(t *testing.T) {
	b := NewBlacklist()
	ip := "198.51.100.42"

	b.BanIP(ip)
	if !b.IsBlacklisted(ip) {
		t.Fatalf("expected IP %s to be banned by manual admin action", ip)
	}
}
