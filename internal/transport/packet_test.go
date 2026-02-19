package transport

import (
	"bytes"
	"testing"
)

func TestPackUnpackRoundtrip(t *testing.T) {
	p := &Packet{
		TypeID:    TypeText,
		SessionID: 0x0123456789abcdef,
		Payload:   []byte("encrypted-payload-placeholder"),
	}
	buf, err := Pack(p)
	if err != nil {
		t.Fatal(err)
	}
	if len(buf) < MinPacketSize {
		t.Fatalf("packed size %d < MinPacketSize %d", len(buf), MinPacketSize)
	}
	got, err := Unpack(buf)
	if err != nil {
		t.Fatal(err)
	}
	if got.TypeID != p.TypeID || got.SessionID != p.SessionID || !bytes.Equal(got.Payload, p.Payload) {
		t.Fatalf("roundtrip mismatch: got %+v", got)
	}
}

func TestUnpackTooShort(t *testing.T) {
	_, err := Unpack(make([]byte, MinPacketSize-1))
	if err != ErrPacketTooShort {
		t.Fatalf("expected ErrPacketTooShort, got %v", err)
	}
}

func TestUnpackChecksumMismatch(t *testing.T) {
	p := &Packet{TypeID: TypeText, SessionID: 1, Payload: []byte("x")}
	buf, _ := Pack(p)
	buf[len(buf)-1] ^= 0xff
	_, err := Unpack(buf)
	if err != ErrChecksum {
		t.Fatalf("expected ErrChecksum, got %v", err)
	}
}
