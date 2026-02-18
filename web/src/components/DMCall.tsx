import React, { useEffect, useRef, useState } from 'react';
import { api, getApiBaseUrl } from '../services/api';
import { getSocket, sendWebSocketMessage } from '../services/websocket';
import { showToast } from './Toast';

interface DMCallProps {
  chatId: string;
  otherUserId: string;
  currentUserId: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  isVideo: boolean;
  onClose: () => void;
  isIncoming?: boolean; // true если это входящий звонок
  offerData?: any; // данные offer для входящего звонка
}

export default function DMCall({ chatId, otherUserId, currentUserId, currentUserName, currentUserAvatar, isVideo, onClose, isIncoming = false, offerData }: DMCallProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState<{local: boolean, remote: boolean}>({local: false, remote: false});
  const [videoFilter, setVideoFilter] = useState<string>('none');
  const [virtualBackground, setVirtualBackground] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const iceServersRef = useRef<RTCConfiguration['iceServers']>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoProcessorRef = useRef<{stream: MediaStream, processor: any} | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);

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
            // Сохраняем как входящий звонок (будет помечен как missed если не ответим)
            callStartTimeRef.current = Date.now();
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
            // Если звонок не был принят, сохраняем как пропущенный
            if (!isConnected && !isCalling) {
              saveCallHistory('missed', data.duration);
            }
            handleHangup();
          }
        } else if (msgType === 'call:recording:request') {
          // Запрос на запись от собеседника
          const consent = confirm('Собеседник хочет записать звонок. Разрешить?');
          sendWebSocketMessage('call:recording:response', {
            chatId,
            to: otherUserId,
            allowed: consent,
          });
          setRecordingConsent(prev => ({ ...prev, remote: consent }));
        } else if (msgType === 'call:recording:response') {
          // Ответ на запрос записи
          if (data.allowed) {
            setRecordingConsent(prev => ({ ...prev, remote: true }));
            if (isRecording) {
              showToast('Собеседник разрешил запись', 'success');
            }
          } else {
            showToast('Собеседник запретил запись', 'warning');
            if (isRecording) {
              stopRecording();
            }
          }
        } else if (msgType === 'screen:share') {
          setRemoteScreenSharing(!!data.active);
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

      // Отправляем offer через WebSocket с информацией о звонящем
      sendWebSocketMessage('webrtc:offer', {
        chatId,
        to: otherUserId,
        from: currentUserId,
        fromName: currentUserName,
        fromAvatar: currentUserAvatar,
        sdp: offer.sdp,
        type: offer.type,
        video: isVideo,
      });

      setIsRinging(true);
      callStartTimeRef.current = Date.now();
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
      
      callStartTimeRef.current = Date.now();
    } catch (e: any) {
      console.error('Failed to accept call:', e);
      showToast('Ошибка принятия звонка: ' + e.message, 'error');
      saveCallHistory('declined');
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

  // Сохранение истории звонка
  const saveCallHistory = async (status: 'completed' | 'missed' | 'declined', duration?: number): Promise<void> => {
    try {
      await api('/api/calls', 'POST', {
        chatId,
        otherUserId,
        type: isVideo ? 'video' : 'voice',
        status,
        duration: duration || (isConnected ? Math.floor((Date.now() - (callStartTimeRef.current || Date.now())) / 1000) : 0),
        startedAt: callStartTimeRef.current || Date.now(),
        endedAt: Date.now(),
      });
    } catch (e) {
      console.error('Failed to save call history:', e);
    }
  };

  const handleHangup = () => {
    // Останавливаем запись если активна
    if (isRecording) {
      stopRecording();
    }

    // Останавливаем screen sharing если активен
    if (isScreenSharing) {
      stopScreenShare();
    }

    // Закрываем потоки
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Закрываем peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Сохраняем историю звонка
    if (isCalling || isConnected) {
      saveCallHistory('completed');
    }

    if (isScreenSharing) {
      sendWebSocketMessage('screen:share', { chatId, to: otherUserId, active: false });
    }
    sendWebSocketMessage('webrtc:hangup', {
      chatId,
      to: otherUserId,
    });

    setIsCalling(false);
    setIsRinging(false);
    setIsConnected(false);
    callStartTimeRef.current = null;
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

  // Экранное разделение
  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: 'always' as any }, 
        audio: true 
      });
      screenStreamRef.current = screenStream;
      
      // Заменяем видео трек в peer connection
      if (peerConnectionRef.current && localStream) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        // Обновляем локальный видео элемент
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        sendWebSocketMessage('screen:share', { chatId, to: otherUserId, active: true });

        // Когда пользователь останавливает демонстрацию экрана
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (e: any) {
      console.error('Failed to start screen share:', e);
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        showToast('Ошибка демонстрации экрана: ' + e.message, 'error');
      }
    }
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Возвращаем камеру
    if (localStream && peerConnectionRef.current) {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }
    sendWebSocketMessage('screen:share', { chatId, to: otherUserId, active: false });
    setIsScreenSharing(false);
  };

  // Запись звонка
  const startRecording = async () => {
    try {
      if (!localStream && !remoteStream) {
        showToast('Нет потоков для записи', 'error');
        return;
      }

      // Запрашиваем согласие на запись
      const consent = confirm('Начать запись звонка? Собеседник будет уведомлен.');
      if (!consent) return;

      setRecordingConsent(prev => ({ ...prev, local: true }));
      
      // Отправляем запрос на согласие собеседнику
      sendWebSocketMessage('call:recording:request', {
        chatId,
        to: otherUserId,
      });

      // Создаем комбинированный поток для записи
      const combinedStream = new MediaStream();
      
      if (localStream) {
        localStream.getTracks().forEach(track => combinedStream.addTrack(track));
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => combinedStream.addTrack(track));
      }

      // Используем MediaRecorder для записи
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000,
      };
      
      const recorder = new MediaRecorder(combinedStream, options);
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('file', blob, `call-${chatId}-${Date.now()}.webm`);
        formData.append('chatId', chatId);
        formData.append('otherUserId', otherUserId);
        formData.append('duration', Math.floor((Date.now() - (recordingStartTimeRef.current || Date.now())) / 1000).toString());
        
        try {
          const response = await fetch(getApiBaseUrl() + '/api/calls/recordings', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: formData
          });
          
          if (!response.ok) {
            throw new Error('Failed to upload recording');
          }
          
          showToast('Запись сохранена', 'success');
        } catch (e: any) {
          showToast('Ошибка сохранения записи: ' + e.message, 'error');
        }
      };
      
      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      recorder.start(1000); // Записываем каждую секунду
      setIsRecording(true);
      
      showToast('Запись начата', 'success');
    } catch (e: any) {
      console.error('Failed to start recording:', e);
      showToast('Ошибка начала записи: ' + e.message, 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingConsent({ local: false, remote: false });
      showToast('Запись остановлена', 'info');
    }
  };

  // Применение фильтров к видео
  const applyVideoFilter = (filter: string) => {
    setVideoFilter(filter);
    if (localVideoRef.current) {
      localVideoRef.current.style.filter = filter === 'none' ? 'none' : getFilterCSS(filter);
    }
  };

  const getFilterCSS = (filter: string): string => {
    const filters: Record<string, string> = {
      'blur': 'blur(5px)',
      'grayscale': 'grayscale(100%)',
      'sepia': 'sepia(100%)',
      'brightness': 'brightness(1.2)',
      'contrast': 'contrast(1.2)',
      'saturate': 'saturate(1.5)',
      'hue-rotate': 'hue-rotate(90deg)',
      'invert': 'invert(100%)',
    };
    return filters[filter] || 'none';
  };

  // Виртуальный фон
  const applyVirtualBackground = async (imageUrl: string | null) => {
    setVirtualBackground(imageUrl);
    // В реальности здесь нужна более сложная обработка через canvas и WebGL
    // Для упрощения используем CSS backdrop-filter
    if (localVideoRef.current) {
      if (imageUrl) {
        // Создаем canvas для обработки фона
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        // Здесь должна быть обработка через TensorFlow.js или WebGL для замены фона
        // Упрощенная версия - просто показываем изображение как overlay
        localVideoRef.current.style.position = 'relative';
      } else {
        localVideoRef.current.style.position = '';
      }
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
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
                {remoteScreenSharing && (
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    🖥️ Демонстрация экрана
                  </div>
                )}
              </div>
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
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {isVideo ? 'Видеозвонок активен' : 'Звонок активен'}
              {isRecording && (
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  background: '#ef4444',
                  borderRadius: '50%',
                  animation: 'pulse 1s infinite'
                }} />
              )}
            </div>
          )}
        </div>

        {/* Меню фильтров и эффектов (только для видео) */}
        {isVideo && isConnected && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 1000
          }}>
            <div style={{ fontSize: '12px', color: 'white', marginBottom: '4px' }}>Фильтры:</div>
            <select
              value={videoFilter}
              onChange={(e) => applyVideoFilter(e.target.value)}
              style={{
                padding: '6px',
                borderRadius: '4px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontSize: '12px'
              }}
            >
              <option value="none">Нет</option>
              <option value="blur">Размытие</option>
              <option value="grayscale">Черно-белый</option>
              <option value="sepia">Сепия</option>
              <option value="brightness">Яркость</option>
              <option value="contrast">Контраст</option>
              <option value="saturate">Насыщенность</option>
              <option value="hue-rotate">Оттенок</option>
              <option value="invert">Инверсия</option>
            </select>
            
            <div style={{ fontSize: '12px', color: 'white', marginTop: '8px', marginBottom: '4px' }}>Виртуальный фон:</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  applyVirtualBackground(url);
                }
              }}
              style={{ fontSize: '11px', color: 'white' }}
            />
            <button
              onClick={() => applyVirtualBackground(null)}
              style={{
                padding: '4px 8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '11px',
                marginTop: '4px'
              }}
            >
              Убрать фон
            </button>
          </div>
        )}

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
            <>
              <button
                onClick={toggleVideo}
                className={`call-control-btn ${!isVideoEnabled ? 'active' : ''}`}
                title={isVideoEnabled ? 'Выключить видео' : 'Включить видео'}
              >
                {isVideoEnabled ? '📹' : '📹❌'}
              </button>
              
              <button
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`call-control-btn ${isScreenSharing ? 'active' : ''}`}
                title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
              >
                {isScreenSharing ? '🖥️⏹️' : '🖥️'}
              </button>
            </>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`call-control-btn ${isRecording ? 'active' : ''}`}
            title={isRecording ? 'Остановить запись' : 'Начать запись'}
          >
            {isRecording ? '🔴⏹️' : '🔴'}
          </button>

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

