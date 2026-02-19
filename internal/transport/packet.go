// Пакет transport: бинарный протокол пакетов Len || Type || SessionID || Payload || Checksum.
// Payload — результат crypto.EncryptGCM (никакого чистого JSON в канале).
package transport

import (
	"encoding/binary"
	"errors"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
)

const (
	LenSize     = 4
	TypeIDSize  = 2
	SessionSize = 8
	ChecksumSize = crypto.HashSize

	HeaderSize = LenSize + TypeIDSize + SessionSize
	MinPacketSize = LenSize + TypeIDSize + SessionSize + ChecksumSize
)

// Message type IDs (compact, Telegram-style). Payloads are binary; no raw JSON.
const (
	TypeText        uint16 = 0x01
	TypeFile        uint16 = 0x02 // payload: [4 byte filename len][filename][raw file bytes]
	TypeTyping      uint16 = 0x03 // payload: "1"|"0"
	TypeReadReceipt uint16 = 0x04
	TypeVoice       uint16 = 0x05 // payload: raw audio bytes (e.g. opus)
	// Admin / system (проверка прав на сервере перед выполнением)
	TypeSystemAlert uint16 = 0x10 // server → client: системное уведомление
	TypeAdminQuery  uint16 = 0x11 // client → server: админ-запрос (подтип в payload)
)

var (
	ErrPacketTooShort = errors.New("transport: packet too short")
	ErrChecksum       = errors.New("transport: checksum mismatch")
)

// Packet is the on-wire frame: length, type, session, encrypted payload, checksum.
type Packet struct {
	TypeID   uint16
	SessionID uint64
	Payload  []byte
}

// Pack encodes p into a single buffer: length (4) || typeID (2) || sessionID (8) || payload || checksum (32).
// Payload must be the raw output of crypto.EncryptGCM. Uses LittleEndian.
func Pack(p *Packet) ([]byte, error) {
	if p == nil {
		return nil, errors.New("transport: nil packet")
	}
	bodyLen := TypeIDSize + SessionSize + len(p.Payload) + ChecksumSize
	buf := make([]byte, LenSize+bodyLen)
	binary.LittleEndian.PutUint32(buf[0:LenSize], uint32(bodyLen))
	binary.LittleEndian.PutUint16(buf[LenSize:LenSize+TypeIDSize], p.TypeID)
	binary.LittleEndian.PutUint64(buf[LenSize+TypeIDSize:HeaderSize], p.SessionID)
	copy(buf[HeaderSize:], p.Payload)
	checksum := crypto.Hash256(p.Payload)
	copy(buf[HeaderSize+len(p.Payload):], checksum[:])
	return buf, nil
}

// Unpack decodes a buffer produced by Pack into a Packet and verifies checksum.
func Unpack(data []byte) (*Packet, error) {
	if len(data) < MinPacketSize {
		return nil, ErrPacketTooShort
	}
	bodyLen := binary.LittleEndian.Uint32(data[0:LenSize])
	if bodyLen < TypeIDSize+SessionSize+ChecksumSize {
		return nil, ErrPacketTooShort
	}
	if len(data) < LenSize+int(bodyLen) {
		return nil, ErrPacketTooShort
	}
	body := data[LenSize : LenSize+bodyLen]
	payloadLen := len(body) - TypeIDSize - SessionSize - ChecksumSize
	if payloadLen < 0 {
		return nil, ErrPacketTooShort
	}
	typeID := binary.LittleEndian.Uint16(body[0:TypeIDSize])
	sessionID := binary.LittleEndian.Uint64(body[TypeIDSize : TypeIDSize+SessionSize])
	payload := body[HeaderSize-LenSize : HeaderSize-LenSize+payloadLen]
	checksumSlice := body[TypeIDSize+SessionSize+payloadLen:]
	var checksum [ChecksumSize]byte
	copy(checksum[:], checksumSlice)
	if !crypto.VerifyHash(payload, checksum) {
		return nil, ErrChecksum
	}
	out := make([]byte, len(payload))
	copy(out, payload)
	return &Packet{
		TypeID:    typeID,
		SessionID: sessionID,
		Payload:   out,
	}, nil
}
