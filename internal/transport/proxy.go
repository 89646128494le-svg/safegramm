package transport

import (
	"net"
	"strings"
)

// RealIP возвращает IP клиента из соединения.
//
// Proxy-ready: при постановке перед сервером Cloudflare Spectrum или своего
// прокси-кластера (как DC у Telegram) достаточно парсить PROXY protocol в первом
// буфере после Accept: v1 — текст "PROXY TCP4 client_ip ...", v2 — binary (0x0D 0x0A 0x0D 0x0A 0x00 0x0D 0x0A 0x51 0x55 0x49 0x54 0x0A); извлечь client address и подставлять в RealIP вместо conn.RemoteAddr().
func RealIP(conn net.Conn) string {
	addr := conn.RemoteAddr().String()
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return strings.TrimSpace(host)
	}
	return addr
}
