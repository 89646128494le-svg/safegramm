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
  const [callDurationSec, setCallDurationSec] = useState(0);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isConnected || !callStartTimeRef.current) return;
    const t = setInterval(() => {
      setCallDurationSec(Math.floor((Date.now() - (callStartTimeRef.current || 0)) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [isConnected]);

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

  const getMediaStream = useCallback(async (wantVideo: boolean): Promise<{ stream: MediaStream; videoFallback: boolean }> => {
    const gum = (opts: { audio: boolean; video: boolean }) => {
      if (navigator.mediaDevices?.getUserMedia) return navigator.mediaDevices.getUserMedia(opts);
      const legacy = (navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia;
      if (!legacy) return Promise.reject(new Error('getUserMedia не поддерживается. Используйте HTTPS и современный браузер.'));
      return new Promise<MediaStream>((resolve, reject) => legacy.call(navigator, opts, resolve, reject));
    };
    if (!wantVideo) return gum({ audio: true, video: false }).then((s) => ({ stream: s, videoFallback: false }));
    try {
      const stream = await gum({ audio: true, video: true });
      return { stream, videoFallback: false };
    } catch (e: any) {
      const name = e?.name || '';
      if (name === 'NotReadableError' || name === 'OverconstrainedError' || name === 'NotFoundError') {
        showToast('Камера недоступна или занята. Звонок только по аудио.', 'info');
        const stream = await gum({ audio: true, video: false });
        return { stream, videoFallback: true };
      }
      throw e;
    }
  }, []);

  const startCall = async () => {
    try {
      setIsCalling(true);
      const { stream, videoFallback } = await getMediaStream(isVideo);
      if (videoFallback) setIsVideoEnabled(false);
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection с потоком
      const pc = createPeerConnection(stream);

      // Создаем offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Отправляем offer через WebSocket. Не кладём type в корень — иначе перезатрёт type сообщения и сервер не распознает webrtc:offer
      sendWebSocketMessage('webrtc:offer', {
        chatId,
        to: String(otherUserId),
        from: currentUserId,
        fromName: currentUserName,
        fromAvatar: currentUserAvatar,
        data: { type: offer.type, sdp: offer.sdp },
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
      const { stream, videoFallback } = await getMediaStream(isVideo);
      if (videoFallback) setIsVideoEnabled(false);
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection с потоком
      const pc = createPeerConnection(stream);

      // Устанавливаем remote description из offer (SDP может быть в data после фикса типа сообщения)
      const sdpPayload = offerData.data || offerData;
      const offerSDP = sdpPayload.sdp ?? offerData.sdp;
      const sdpType = sdpPayload.type || 'offer';
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: sdpType,
        sdp: typeof offerSDP === 'string' ? offerSDP : (offerSDP?.sdp ?? ''),
      }));

      // Создаем answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Отправляем answer через WebSocket
      sendWebSocketMessage('webrtc:answer', {
        chatId,
        to: otherUserId,
        data: { type: answer.type, sdp: answer.sdp },
      });
      
      callStartTimeRef.current = Date.now();
    } catch (e: any) {
      console.error('Failed to accept call:', e);
      const msg = (e?.message || '').toLowerCase();
      const name = e?.name || '';
      const friendly = name === 'NotReadableError' || msg.includes('video source') || msg.includes('could not start')
        ? 'Камера или микрофон заняты другим приложением. Закройте другие программы, использующие камеру, или попробуйте голосовой звонок.'
        : (e?.message || 'Ошибка принятия звонка.');
      showToast(friendly, 'error');
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
        durationSec={isConnected ? callDurationSec : undefined}
      />
    );
  }

  return (
    <div className="dm-call-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(145deg, #0b0f1a 0%, #0f1629 35%, #131c2e 70%, #0d1321 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Декоративная сетка/шум для глубины */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(124,108,255,0.15) 0%, transparent 50%)',
      }} />
      {!isVideo && <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />}
      <div className="dm-call-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
        <div className="dm-call-header" style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px',
          background: 'linear-gradient(180deg, rgba(15,20,35,0.92) 0%, rgba(15,20,35,0.4) 70%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {isVideo ? 'Видеозвонок' : 'Звонок'} {isConnected && ` · ${otherDisplayName}`}
            </h3>
            {isConnected && (
              <span style={{
                fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)',
                fontVariantNumeric: 'tabular-nums',
                padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)',
              }}>
                {formatDuration(callDurationSec)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isRecording && (
              <span style={{
                fontSize: 12, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', fontWeight: 500,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.2s ease-in-out infinite' }} />
                Запись
              </span>
            )}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleHangup}
              className="close-call-btn"
              style={{
                width: 42, height: 42, borderRadius: 12, border: 'none',
                background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 18,
                boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
              }}
            >
              ✕
            </motion.button>
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
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(15,20,35,0.85) 0%, rgba(10,14,26,0.95) 100%)',
                backdropFilter: 'blur(20px)',
                zIndex: 5,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                style={{
                  width: 120, height: 120, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(124,108,255,0.25) 0%, rgba(59,130,246,0.2) 100%)',
                  border: '2px solid rgba(124,108,255,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 52, marginBottom: 24,
                  boxShadow: '0 0 60px rgba(124,108,255,0.2), inset 0 0 40px rgba(124,108,255,0.05)',
                }}
              >
                {isVideo ? '📹' : '📞'}
              </motion.div>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.02em' }}>
                {!isIncoming ? 'Ожидание ответа...' : 'Подключение...'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, maxWidth: 320, textAlign: 'center' }}>
                {!isIncoming ? `Звонок ${otherDisplayName}` : 'Принятие звонка...'}
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 28,
                background: 'rgba(15,20,35,0.5)',
                borderRadius: 24,
                padding: 56,
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <div style={{
                width: 160, height: 160, borderRadius: '50%',
                background: 'linear-gradient(145deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 72,
                boxShadow: '0 0 80px rgba(99,102,241,0.35), 0 20px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}>
                📞
              </div>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{otherDisplayName}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Голосовой звонок · {formatDuration(callDurationSec)}</div>
            </motion.div>
          )}

          {isVideo && isConnected && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                position: 'absolute', top: 72, right: 16, zIndex: 10,
                background: 'rgba(15,20,35,0.88)', borderRadius: 14, padding: 14,
                display: 'flex', flexDirection: 'column', gap: 10,
                backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Фильтры</div>
              <select
                value={videoFilter}
                onChange={(e) => applyVideoFilter(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.1)',
                  color: '#fff', border: '1px solid rgba(255,255,255,0.15)', fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <option value="none">Нет</option>
                <option value="blur">Размытие</option>
                <option value="grayscale">Ч/Б</option>
                <option value="sepia">Сепия</option>
              </select>
            </motion.div>
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

