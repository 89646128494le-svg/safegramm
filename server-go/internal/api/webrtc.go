package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetICEServers возвращает список ICE серверов для WebRTC
func GetICEServers() gin.HandlerFunc {
	return func(c *gin.Context) {
		// STUN серверы (публичные, бесплатные)
		// RTCPeerConnection не поддерживает query параметры в URL
		iceServers := []gin.H{
			{
				"urls": "stun:stun.l.google.com:19302",
			},
			{
				"urls": "stun:stun1.l.google.com:19302",
			},
			{
				"urls": "stun:stun2.l.google.com:19302",
			},
		}

		// Если есть TURN серверы в конфиге, добавляем их
		// В production здесь должны быть ваши TURN серверы
		// turnServer := os.Getenv("TURN_SERVER")
		// if turnServer != "" {
		// 	iceServers = append(iceServers, gin.H{
		// 		"urls":       []string{turnServer},
		// 		"username":  os.Getenv("TURN_USERNAME"),
		// 		"credential": os.Getenv("TURN_PASSWORD"),
		// 	})
		// }

		c.JSON(http.StatusOK, gin.H{"iceServers": iceServers})
	}
}

// WebRTC signaling будет через WebSocket
// События: webrtc:offer, webrtc:answer, webrtc:ice, webrtc:hangup

