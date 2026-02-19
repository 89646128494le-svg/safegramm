package main

/*
#cgo CFLAGS: -I.
#cgo LDFLAGS: -lm
*/
import "C"

import (
	"unsafe"

	"github.com/89646128494le-svg/safegram-core/internal/engine"
)

func main() {}

// GoBridge_GenerateKeyPair генерирует пару ключей ECDH. privOut, pubOut — буферы по 32 байта.
// Возвращает 0 при успехе, -1 при ошибке.
//export GoBridge_GenerateKeyPair
func GoBridge_GenerateKeyPair(privOut, pubOut *C.uchar) C.int {
	if privOut == nil || pubOut == nil {
		return -1
	}
	priv := unsafe.Slice((*byte)(unsafe.Pointer(privOut)), 32)
	pub := unsafe.Slice((*byte)(unsafe.Pointer(pubOut)), 32)
	if err := engine.BridgeGenerateKeyPair(priv, pub); err != nil {
		return -1
	}
	return 0
}

// GoBridge_SharedSecret вычисляет ECDH(priv, peerPub). Все буферы 32 байта.
//export GoBridge_SharedSecret
func GoBridge_SharedSecret(priv, peerPub, secretOut *C.uchar) C.int {
	if priv == nil || peerPub == nil || secretOut == nil {
		return -1
	}
	privS := unsafe.Slice((*byte)(unsafe.Pointer(priv)), 32)
	pubS := unsafe.Slice((*byte)(unsafe.Pointer(peerPub)), 32)
	outS := unsafe.Slice((*byte)(unsafe.Pointer(secretOut)), 32)
	if err := engine.BridgeSharedSecret(privS, pubS, outS); err != nil {
		return -1
	}
	return 0
}

// GoBridge_DeriveAESKey выводит сессионный ключ из sharedSecret (32 байта). keyOut — 32 байта.
//export GoBridge_DeriveAESKey
func GoBridge_DeriveAESKey(sharedSecret, keyOut *C.uchar) {
	if sharedSecret == nil || keyOut == nil {
		return
	}
	sec := unsafe.Slice((*byte)(unsafe.Pointer(sharedSecret)), 32)
	out := unsafe.Slice((*byte)(unsafe.Pointer(keyOut)), 32)
	engine.BridgeDeriveAESKey(sec, out)
}

// GoBridge_SendMessage шифрует текст и возвращает wire-пакет. Вызывающий обязан освободить буфер через free(ptr).
// key — 32 байта. Возвращает указатель и длину; при ошибке (nil, 0).
//export GoBridge_SendMessage
func GoBridge_SendMessage(sessionID C.ulonglong, msgType C.ushort, text *C.char, key *C.uchar) (ptr *C.uchar, length C.size_t) {
	if text == nil || key == nil {
		return nil, 0
	}
	txt := C.GoString(text)
	keyS := unsafe.Slice((*byte)(unsafe.Pointer(key)), 32)
	out, err := engine.BridgeSendMessage(uint64(sessionID), uint16(msgType), txt, keyS)
	if err != nil || len(out) == 0 {
		return nil, 0
	}
	p := C.CBytes(out)
	return (*C.uchar)(p), C.size_t(len(out))
}

// GoBridge_ReceiveMessage распаковывает и расшифровывает пакет. key — 32 байта.
// Возвращает выделенную строку (вызывающий обязан free). При ошибке — nil.
//export GoBridge_ReceiveMessage
func GoBridge_ReceiveMessage(data *C.uchar, dataLen C.size_t, key *C.uchar) *C.char {
	if data == nil || key == nil {
		return nil
	}
	dataS := unsafe.Slice((*byte)(unsafe.Pointer(data)), int(dataLen))
	keyS := unsafe.Slice((*byte)(unsafe.Pointer(key)), 32)
	s, err := engine.BridgeReceiveMessage(dataS, keyS)
	if err != nil {
		return nil
	}
	return C.CString(s)
}

// GoBridge_InitializeSession по clientPriv и serverPub заполняет sessionKeyOut (32 байта). Возврат 0 = успех.
//export GoBridge_InitializeSession
func GoBridge_InitializeSession(clientPriv, serverPub, sessionKeyOut *C.uchar) C.int {
	if clientPriv == nil || serverPub == nil || sessionKeyOut == nil {
		return -1
	}
	priv := unsafe.Slice((*byte)(unsafe.Pointer(clientPriv)), 32)
	pub := unsafe.Slice((*byte)(unsafe.Pointer(serverPub)), 32)
	out := unsafe.Slice((*byte)(unsafe.Pointer(sessionKeyOut)), 32)
	if err := engine.InitializeSession(priv, pub, out); err != nil {
		return -1
	}
	return 0
}

// GoBridge_EncryptAndPack — шифрует и упаковывает (алиас SendMessage). Буфер освобождать через free(ptr).
//export GoBridge_EncryptAndPack
func GoBridge_EncryptAndPack(sessionID C.ulonglong, msgType C.ushort, text *C.char, key *C.uchar) (ptr *C.uchar, length C.size_t) {
	return GoBridge_SendMessage(sessionID, msgType, text, key)
}

// GoBridge_UnpackAndDecrypt — распаковывает и расшифровывает (алиас ReceiveMessage). Строку освобождать через free.
//export GoBridge_UnpackAndDecrypt
func GoBridge_UnpackAndDecrypt(data *C.uchar, dataLen C.size_t, key *C.uchar) *C.char {
	return GoBridge_ReceiveMessage(data, dataLen, key)
}

// GoBridge_UnpackAndDecryptEx — распаковывает, расшифровывает, возвращает typeID в outType и payload как строку (free).
//export GoBridge_UnpackAndDecryptEx
func GoBridge_UnpackAndDecryptEx(data *C.uchar, dataLen C.size_t, key *C.uchar, outType *C.ushort) *C.char {
	if data == nil || key == nil {
		return nil
	}
	dataS := unsafe.Slice((*byte)(unsafe.Pointer(data)), int(dataLen))
	keyS := unsafe.Slice((*byte)(unsafe.Pointer(key)), 32)
	msgType, plain, err := engine.BridgeReceivePacket(dataS, keyS)
	if err != nil {
		return nil
	}
	if outType != nil {
		*outType = C.ushort(msgType)
	}
	return C.CString(string(plain))
}
