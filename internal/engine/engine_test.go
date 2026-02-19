package engine

import (
	"testing"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
	"github.com/89646128494le-svg/safegram-core/internal/transport"
)

func TestCore_SendReceiveRoundtrip(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	var c Core
	text := "Hello, SafeGram!"
	wire, err := c.SendMessage(0xdeadbeef, transport.TypeText, text, key)
	if err != nil {
		t.Fatal(err)
	}
	got, err := c.ReceiveMessage(wire, key)
	if err != nil {
		t.Fatal(err)
	}
	if got != text {
		t.Fatalf("got %q", got)
	}
}

func TestCore_SendMessage_BadKey(t *testing.T) {
	var c Core
	_, err := c.SendMessage(1, transport.TypeText, "x", []byte("short"))
	if err != crypto.ErrInvalidKey {
		t.Fatalf("expected ErrInvalidKey, got %v", err)
	}
}

func TestCore_ReceiveMessage_BadKey(t *testing.T) {
	var c Core
	_, err := c.ReceiveMessage(nil, []byte("short"))
	if err != crypto.ErrInvalidKey {
		t.Fatalf("expected ErrInvalidKey, got %v", err)
	}
}
