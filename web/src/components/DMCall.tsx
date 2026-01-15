import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { getSocket, sendWebSocketMessage } from '../services/websocket';
import { showToast } from './Toast';

interface DMCallProps {
  chatId: string;
  otherUserId: string;
  currentUserId: string;
  isVideo: boolean;
  onClose: () => void;
  isIncoming?: boolean; // true если это входящий звонок
  offerData?: any; // данные offer для входящего звонка
}

export default function DMCall({ chatId, otherUserId, currentUserId, isVideo, onClose, isIncoming = false, offerData }: DMCallProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const iceServersRef = useRef<RTCConfiguration['iceServers']>([]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (socket) {
      const handleMessage = (event: MessageEvent) => {
        try {
          // Бэкенд может отправлять несколько JSON через \n
          const messages = event.data.split('\n').filter(m => m.trim());
          for (const msgText of messages) {
            if (!msgText.trim()) continue;
            try {
              const data = JSON.parse(msgText);
              handleWebSocketMessage(data);
            } catch (e) {
              console.warn('Failed to parse WebSocket message chunk:', e, msgText);
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      const handleWebSocketMessage = (data: any) => {
        const msgType = data.type;

        if (msgType === 'webrtc:offer') {
          // Входящий звонок (если мы еще не в звонке)
          if (data.from === otherUserId && data.chatId === chatId && !isCalling) {
            setIsRinging(true);
          }
        } else if (msgType === 'webrtc:answer') {
          // Ответ на наш offer
          if (data.from === otherUserId && data.chatId === chatId) {
            handleAnswer(data);
          }
        } else if (msgType === 'webrtc:ice') {
          // ICE candidate
          if (data.from === otherUserId && data.chatId === chatId) {
            handleICE(data);
          }
        } else if (msgType === 'webrtc:hangup') {
          // Звонок завершен
          if (data.from === otherUserId && data.chatId === chatId) {
            handleHangup();
          }
        }
      };

      socket.addEventListener('message', handleMessage);

      return () => {
        socket.removeEventListener('message', handleMessage);
      };
    }
  }, [chatId, otherUserId]);

  // Загрузка ICE серверов
  useEffect(() => {
    const loadICEServers = async () => {
      try {
        const response = await api('/api/rtc/ice');
        iceServersRef.current = response.iceServers || [
          { urls: 'stun:stun.l.google.com:19302' }
        ];
      } catch (e) {
        console.warn('Failed to load ICE servers, using fallback');
        iceServersRef.current = [{ urls: 'stun:stun.l.google.com:19302' }];
      }
    };
    loadICEServers();
  }, []);

  const createPeerConnection = (stream?: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    // Добавляем локальный поток
    const streamToUse = stream || localStream;
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => {
        pc.addTrack(track, streamToUse);
      });
    }

    // Обработка удаленного потока
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setIsConnected(true);
        setIsRinging(false);
      }
    };

    // Обработка ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebSocketMessage('webrtc:ice', {
          chatId,
          to: otherUserId,
          candidate: event.candidate,
        });
      }
    };

    // Обработка изменения состояния соединения
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleHangup();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    try {
      setIsCalling(true);
      
      // Получаем медиа поток с поддержкой старых браузеров
      let stream: MediaStream;
      
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Современный API
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo,
        });
      } else {
        // Fallback для старых браузеров
        const getUserMedia = (navigator as any).getUserMedia || 
                            (navigator as any).webkitGetUserMedia || 
                            (navigator as any).mozGetUserMedia;
        
        if (!getUserMedia) {
          throw new Error('getUserMedia не поддерживается в этом браузере. Пожалуйста, используйте современный браузер или включите HTTPS.');
        }
        
        // Используем старый API с Promise
        stream = await new Promise<MediaStream>((resolve, reject) => {
          getUserMedia.call(navigator, {
            audio: true,
            video: isVideo,
          }, resolve, reject);
        });
        
        showToast('Используется устаревший API. Рекомендуется использовать HTTPS.', 'warning');
      }
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection с потоком
      const pc = createPeerConnection(stream);

      // Создаем offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Отправляем offer через WebSocket
      sendWebSocketMessage('webrtc:offer', {
        chatId,
        to: otherUserId,
        sdp: offer.sdp,
        type: offer.type,
        video: isVideo,
      });

      setIsRinging(true);
    } catch (e: any) {
      console.error('Failed to start call:', e);
      showToast('Ошибка начала звонка: ' + e.message, 'error');
      handleHangup();
    }
  };

  const handleAcceptCall = async (offerData: any) => {
    try {
      setIsRinging(false);
      setIsCalling(true);

      // Получаем медиа поток с поддержкой старых браузеров
      let stream: MediaStream;
      
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Современный API
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo,
        });
      } else {
        // Fallback для старых браузеров
        const getUserMedia = (navigator as any).getUserMedia || 
                            (navigator as any).webkitGetUserMedia || 
                            (navigator as any).mozGetUserMedia;
        
        if (!getUserMedia) {
          throw new Error('getUserMedia не поддерживается в этом браузере. Пожалуйста, используйте современный браузер или включите HTTPS.');
        }
        
        // Используем старый API с Promise
        stream = await new Promise<MediaStream>((resolve, reject) => {
          getUserMedia.call(navigator, {
            audio: true,
            video: isVideo,
          }, resolve, reject);
        });
        
        showToast('Используется устаревший API. Рекомендуется использовать HTTPS.', 'warning');
      }
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection с потоком
      const pc = createPeerConnection(stream);

      // Устанавливаем remote description из offer
      const offerSDP = offerData.sdp || offerData.data?.sdp || offerData;
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: typeof offerSDP === 'string' ? offerSDP : offerSDP.sdp,
      }));

      // Создаем answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Отправляем answer через WebSocket
      sendWebSocketMessage('webrtc:answer', {
        chatId,
        to: otherUserId,
        sdp: answer.sdp,
        type: answer.type,
      });
    } catch (e: any) {
      console.error('Failed to accept call:', e);
      showToast('Ошибка принятия звонка: ' + e.message, 'error');
      handleHangup();
    }
  };

  const handleAnswer = async (answerData: any) => {
    if (!peerConnectionRef.current) return;

    try {
      const answerSDP = answerData.sdp || answerData.data?.sdp || answerData;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: typeof answerSDP === 'string' ? answerSDP : answerSDP.sdp,
      }));
      setIsRinging(false);
    } catch (e) {
      console.error('Failed to handle answer:', e);
    }
  };

  const handleICE = async (iceData: any) => {
    if (!peerConnectionRef.current) return;

    try {
      const candidate = iceData.candidate || iceData.data?.candidate || iceData;
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Failed to handle ICE candidate:', e);
    }
  };

  const handleHangup = () => {
    // Закрываем потоки
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }

    // Закрываем peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Отправляем hangup
    sendWebSocketMessage('webrtc:hangup', {
      chatId,
      to: otherUserId,
    });

    setIsCalling(false);
    setIsRinging(false);
    setIsConnected(false);
    onClose();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Начинаем звонок при монтировании
  useEffect(() => {
    if (isIncoming && offerData) {
      // Входящий звонок - принимаем
      handleAcceptCall(offerData);
    } else if (!isIncoming) {
      // Исходящий звонок - начинаем
      startCall();
    }
    return () => {
      handleHangup();
    };
  }, [isIncoming, offerData]);

  // Обновляем remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="dm-call-overlay">
      <div className="dm-call-container">
        <div className="dm-call-header">
          <h3>{isVideo ? 'Видеозвонок' : 'Звонок'}</h3>
          <button onClick={handleHangup} className="close-call-btn">✕</button>
        </div>

        <div className="dm-call-video-container">
          {isVideo && (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  background: '#000'
                }}
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
                style={{
                  position: 'absolute',
                  bottom: '80px',
                  right: '20px',
                  width: '200px',
                  height: '150px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '2px solid var(--accent)',
                  background: '#000'
                }}
              />
            </>
          )}
          
          {!isVideo && (
            <div className="audio-call-avatar" style={{
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '80px',
              color: 'white',
              margin: '0 auto',
              marginTop: '100px'
            }}>
              📞
            </div>
          )}

          {isRinging && (
            <div className="call-status" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'white'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔔</div>
              <div>{isCalling ? 'Звонок...' : 'Входящий звонок'}</div>
            </div>
          )}

          {isConnected && !isRinging && (
            <div className="call-status" style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              color: 'white',
              background: 'rgba(0,0,0,0.5)',
              padding: '8px 16px',
              borderRadius: '8px'
            }}>
              {isVideo ? 'Видеозвонок активен' : 'Звонок активен'}
            </div>
          )}
        </div>

        <div className="dm-call-controls" style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          <button
            onClick={toggleMute}
            className={`call-control-btn ${isMuted ? 'active' : ''}`}
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          
          {isVideo && (
            <button
              onClick={toggleVideo}
              className={`call-control-btn ${!isVideoEnabled ? 'active' : ''}`}
              title={isVideoEnabled ? 'Выключить видео' : 'Включить видео'}
            >
              {isVideoEnabled ? '📹' : '📹❌'}
            </button>
          )}

          <button
            onClick={handleHangup}
            className="call-control-btn hangup"
            title="Завершить звонок"
            style={{ background: '#ef4444' }}
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
}

