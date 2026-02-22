// Пакет transport: бинарный протокол пакетов Len || Type || SessionID || Payload || Checksum.
// Payload — результат crypto.EncryptGCM (никакого чистого JSON в канале).
package transport

import (
	"encoding/binary"
	"errors"

	"github.com/89646128494le-svg/safegram-core/internal/crypto"
)

const (
	LenSize      = 4
	TypeIDSize   = 2
	SessionSize  = 8
	ChecksumSize = crypto.HashSize
	RatchetStepSize = 4
	SignatureSize   = crypto.Ed25519SignatureSize

	HeaderSize    = LenSize + TypeIDSize + SessionSize
	HeaderSizeV2  = LenSize + TypeIDSize + SessionSize + RatchetStepSize
	MinPacketSize = LenSize + TypeIDSize + SessionSize + ChecksumSize
	MinPacketSizeV2 = LenSize + TypeIDSize + SessionSize + RatchetStepSize + SignatureSize + ChecksumSize
)

// Message type IDs (compact, Telegram-style). Payloads are binary; no raw JSON.
const (
	TypeText        uint16 = 0x01
	TypeFile        uint16 = 0x02 // payload: [4 byte filename len][filename][raw file bytes]
	TypeTyping      uint16 = 0x03 // payload: "1"|"0"
	TypeReadReceipt uint16 = 0x04
	TypeVoice       uint16 = 0x05 // payload: raw audio bytes (e.g. opus)
	// Admin / system (проверка прав на сервере перед выполнением)
	TypeSystemAlert  uint16 = 0x10 // server → client: системное уведомление
	TypeAdminQuery   uint16 = 0x11 // client → server: админ-запрос (подтип в payload)
	TypeLoginSuccess uint16 = 0x12 // server → client: успешный логин, payload = JSON { "role": "admin", ... }
	TypeBindSession  uint16 = 0x13 // client → server: привязать сессию к пользователю (token в payload)
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

// SignedDataForPacket возвращает данные для подписи Ed25519: typeID || sessionID || ratchetStep || payload.
func SignedDataForPacket(typeID uint16, sessionID uint64, ratchetStep uint32, payload []byte) []byte {
	buf := make([]byte, TypeIDSize+SessionSize+RatchetStepSize+len(payload))
	binary.LittleEndian.PutUint16(buf[0:], typeID)
	binary.LittleEndian.PutUint64(buf[2:], sessionID)
	binary.LittleEndian.PutUint32(buf[10:], ratchetStep)
	copy(buf[14:], payload)
	return buf
}

// PackSigned кодирует пакет V2 (подпись + ratchet): typeID || sessionID || ratchetStep || payload || signature(64) || checksum(32).
func PackSigned(typeID uint16, sessionID uint64, ratchetStep uint32, payload, signature []byte) ([]byte, error) {
	if len(signature) != SignatureSize {
		return nil, errors.New("transport: signature must be 64 bytes")
	}
	bodyLen := TypeIDSize + SessionSize + RatchetStepSize + len(payload) + SignatureSize + ChecksumSize
	buf := make([]byte, LenSize+bodyLen)
	binary.LittleEndian.PutUint32(buf[0:LenSize], uint32(bodyLen))
	binary.LittleEndian.PutUint16(buf[LenSize:], typeID)
	binary.LittleEndian.PutUint64(buf[LenSize+TypeIDSize:], sessionID)
	binary.LittleEndian.PutUint32(buf[LenSize+TypeIDSize+SessionSize:], ratchetStep)
	off := LenSize + TypeIDSize + SessionSize + RatchetStepSize
	copy(buf[off:], payload)
	copy(buf[off+len(payload):], signature)
	checksum := crypto.Hash256(payload)
	copy(buf[off+len(payload)+SignatureSize:], checksum[:])
	return buf, nil
}

// UnpackSigned разбирает пакет V2; возвращает typeID, sessionID, ratchetStep, payload, signature. Checksum проверен.
func UnpackSigned(data []byte) (typeID uint16, sessionID uint64, ratchetStep uint32, payload, signature []byte, err error) {
	if len(data) < MinPacketSizeV2 {
		err = ErrPacketTooShort
		return
	}
	bodyLen := binary.LittleEndian.Uint32(data[0:LenSize])
	if len(data) < LenSize+int(bodyLen) {
		err = ErrPacketTooShort
		return
	}
	body := data[LenSize : LenSize+bodyLen]
	if len(body) < TypeIDSize+SessionSize+RatchetStepSize+SignatureSize+ChecksumSize {
		err = ErrPacketTooShort
		return
	}
	typeID = binary.LittleEndian.Uint16(body[0:TypeIDSize])
	sessionID = binary.LittleEndian.Uint64(body[TypeIDSize : TypeIDSize+SessionSize])
	ratchetStep = binary.LittleEndian.Uint32(body[TypeIDSize+SessionSize : TypeIDSize+SessionSize+RatchetStepSize])
	off := TypeIDSize + SessionSize + RatchetStepSize
	payloadLen := len(body) - off - SignatureSize - ChecksumSize
	if payloadLen < 0 {
		err = ErrPacketTooShort
		return
	}
	payload = make([]byte, payloadLen)
	copy(payload, body[off:off+payloadLen])
	signature = make([]byte, SignatureSize)
	copy(signature, body[off+payloadLen:off+payloadLen+SignatureSize])
	checksumSlice := body[off+payloadLen+SignatureSize:]
	var checksum [ChecksumSize]byte
	copy(checksum[:], checksumSlice)
	if !crypto.VerifyHash(payload, checksum) {
		err = ErrChecksum
		return
	}
	return typeID, sessionID, ratchetStep, payload, signature, nil
}
