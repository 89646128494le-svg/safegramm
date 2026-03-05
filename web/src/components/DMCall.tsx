import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, getApiBaseUrl } from '../services/api';
import { getSocket, sendWebSocketMessage } from '../services/websocket';
import { showToast } from './Toast';
import CallParticipantTile from './call/CallParticipantTile';
import CallControlBar from './call/CallControlBar';
import FloatingCallBar from './call/FloatingCallBar';
import { useSpeakingDetection } from '../hooks/useSpeakingDetection';

interface DMCallProps {
  chatId: string;
  otherUserId: string;
  currentUserId: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  isVideo: boolean;
  onClose: () => void;
  isIncoming?: boolean;
  offerData?: any;
}

export default function DMCall({ chatId, otherUserId, currentUserId, currentUserName, currentUserAvatar, otherUserName, otherUserAvatar, isVideo, onClose, isIncoming = false, offerData }: DMCallProps) {
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
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
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
  const [minimized, setMinimized] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [localReaction, setLocalReaction] = useState<string | null>(null);
  const [remoteReaction, setRemoteReaction] = useState<string | null>(null);

  const { level: localSpeakingLevel, isSpeaking: localSpeaking } = useSpeakingDetection(localStream, !isMuted);
  useEffect(() => {
    sendWebSocketMessage('call:speaking', {
      chatId,
      to: otherUserId,
      active: localSpeaking,
    });
  }, [localSpeaking, chatId, otherUserId]);

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
        } else if (msgType === 'call:reaction' && data.from === otherUserId) {
          setRemoteReaction(data.emoji || null);
          setTimeout(() => setRemoteReaction(null), 2500);
        } else if (msgType === 'call:speaking' && data.from === otherUserId) {
          setRemoteSpeaking(!!data.active);
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

      // Отправляем offer через WebSocket (to — строка, иначе бэкенд может не доставить)
      sendWebSocketMessage('webrtc:offer', {
        chatId,
        to: String(otherUserId),
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

  const sendReaction = useCallback((emoji: string) => {
    sendWebSocketMessage('call:reaction', { chatId, to: otherUserId, emoji });
    setLocalReaction(emoji);
    setTimeout(() => setLocalReaction(null), 2500);
  }, [chatId, otherUserId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        if (!e.repeat) toggleMute();
        e.preventDefault();
      }
      if ((e.key === 'v' || e.key === 'V') && isVideo) {
        if (!e.repeat) toggleVideo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isVideo]);

  // Начинаем звонок при монтировании
  useEffect(() => {
    if (isIncoming && offerData) {
      handleAcceptCall(offerData);
    } else if (!isIncoming) {
      startCall();
    }
    return () => {
      handleHangup();
    };
  }, [isIncoming, offerData]);

  // Авто-завершение, если долго нет соединения (чтобы не залипал экран «Звонок»)
  useEffect(() => {
    if (!(isCalling || isRinging) || isConnected) return;
    const t = setTimeout(() => {
      if (!isConnected) {
        showToast('Звонок не отвечает. Завершение.', 'info');
        handleHangup();
      }
    }, 90000);
    return () => clearTimeout(t);
  }, [isCalling, isRinging, isConnected]);

  // Обновляем remote video и audio (для голосовых — звук через audio, иначе через video)
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.volume = 1;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [remoteStream]);

  const otherDisplayName = (offerData as any)?.fromName || otherUserName || 'Пользователь';
  const otherAvatar = (offerData as any)?.fromAvatar || otherUserAvatar;

  if (minimized && (isCalling || isConnected)) {
    return (
      <FloatingCallBar
        title={isConnected ? otherDisplayName : `Звонок ${otherDisplayName}...`}
        isVideo={isVideo}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        onExpand={() => setMinimized(false)}
        onHangup={handleHangup}
        avatarUrl={(offerData as any)?.fromAvatar || otherUserAvatar}
      />
    );
  }

  return (
    <div className="dm-call-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(180deg, #0a0e1a 0%, #111827 50%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Скрытый audio для голосового звонка — без него удалённый звук не воспроизводится */}
      {!isVideo && <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />}
      <div className="dm-call-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
        <div className="dm-call-header" style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
        }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 600 }}>
            {isVideo ? 'Видеозвонок' : 'Звонок'} {isConnected && ` · ${otherDisplayName}`}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isRecording && (
              <span style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                Запись
              </span>
            )}
            <button
              onClick={handleHangup}
              className="close-call-btn"
              style={{
                width: 40, height: 40, borderRadius: 12, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: 18,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="dm-call-video-container" style={{
          flex: 1, position: 'relative', display: 'grid',
          gridTemplateColumns: isVideo ? '1fr 280px' : '1fr',
          gridTemplateRows: '1fr',
          gap: 16, padding: 16, paddingTop: 72, paddingBottom: 100, minHeight: 0,
        }}>
          {isRinging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 5,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                {!isIncoming ? 'Ожидание ответа...' : 'Подключение...'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>
                {!isIncoming ? `Звонок ${otherDisplayName} — дождитесь ответа на другом устройстве` : 'Принятие звонка...'}
              </div>
            </motion.div>
          )}

          {isVideo ? (
            <>
              <CallParticipantTile
                stream={remoteStream}
                displayName={otherDisplayName}
                avatarUrl={otherAvatar}
                isMuted={false}
                isVideoOff={!remoteStream?.getVideoTracks()?.length}
                isSpeaking={remoteSpeaking}
                reaction={remoteReaction}
                isScreenShare={remoteScreenSharing}
                videoStyle={{ objectFit: 'cover' }}
              />
              <CallParticipantTile
                stream={localStream}
                displayName={currentUserName || 'Вы'}
                avatarUrl={currentUserAvatar}
                isMuted={isMuted}
                isVideoOff={!isVideoEnabled}
                isSpeaking={localSpeaking}
                speakingLevel={localSpeakingLevel}
                reaction={localReaction}
                isLocal
                isScreenShare={isScreenSharing}
                videoStyle={{ objectFit: 'cover' }}
              />
            </>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 24, background: 'rgba(15,20,35,0.6)', borderRadius: 20, padding: 48,
            }}>
              <div style={{
                width: 160, height: 160, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 72, boxShadow: '0 0 60px rgba(59, 130, 246, 0.3)',
              }}>
                📞
              </div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>{otherDisplayName}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Голосовой звонок</div>
            </div>
          )}

          {isVideo && isConnected && (
            <div style={{
              position: 'absolute', top: 72, right: 16, zIndex: 10,
              background: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8, backdropFilter: 'blur(12px)',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Фильтры</div>
              <select
                value={videoFilter}
                onChange={(e) => applyVideoFilter(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.1)',
                  color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontSize: 12,
                }}
              >
                <option value="none">Нет</option>
                <option value="blur">Размытие</option>
                <option value="grayscale">Ч/Б</option>
                <option value="sepia">Сепия</option>
              </select>
            </div>
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', justifyContent: 'center',
        }}>
          <CallControlBar
            isMuted={isMuted}
            isVideoEnabled={isVideoEnabled}
            isScreenSharing={isScreenSharing}
            isRecording={isRecording}
            onMuteToggle={toggleMute}
            onVideoToggle={toggleVideo}
            onScreenShareToggle={isScreenSharing ? stopScreenShare : startScreenShare}
            onRecordingToggle={isRecording ? stopRecording : startRecording}
            onReaction={sendReaction}
            onHangup={handleHangup}
            onMinimize={() => setMinimized(true)}
            showVideo={isVideo}
            showScreenShare={isVideo}
            showRecording
            showReactions
            showMinimize
          />
        </div>
      </div>
    </div>
  );
}

