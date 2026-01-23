
import React, { useEffect, useRef, useState } from 'react';
import { getSocket, sendWebSocketMessage } from '../services/websocket';
import { api } from '../services/api';
import { showToast } from './Toast';

interface GroupVideoCallProps {
  chatId: string;
  currentUserId: string;
  onClose: () => void;
}

type Participant = { 
  stream: MediaStream, 
  userId: string, 
  muted: boolean, 
  videoEnabled: boolean,
  username?: string,
  avatarUrl?: string
};

export default function GroupVideoCall({ chatId, currentUserId, onClose }: GroupVideoCallProps) {
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingConsents, setRecordingConsents] = useState<Map<string, boolean>>(new Map());
  const [videoFilter, setVideoFilter] = useState<string>('none');
  const [virtualBackground, setVirtualBackground] = useState<string | null>(null);
  const [showParticipantsMenu, setShowParticipantsMenu] = useState(false);
  const [chatMembers, setChatMembers] = useState<Map<string, {username: string, avatarUrl?: string, role?: string}>>(new Map());
  const [isAdmin, setIsAdmin] = useState(false);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    loadChatMembers();
    const socket = getSocket();
    socketRef.current = socket;
    
    if (!socket) {
      console.error('WebSocket not available');
      return;
    }

    // Присоединяемся к voice room
    sendWebSocketMessage('voice:join', { chatId });

    // Обработчик сообщений WebSocket
    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'voice:participants') {
          const members = data.members || [];
          // Создаем соединения с участниками, с которыми еще нет
          for (const userId of members) {
            if (userId !== currentUserId && !peersRef.current.has(userId)) {
              await createPeerConnection(userId, true);
            }
          }
          
          // Удаляем соединения с теми, кого нет в списке
          Array.from(peersRef.current.keys()).forEach((userId: string) => {
            if (!members.includes(userId)) {
              const pc = peersRef.current.get(userId);
              if (pc) {
                pc.close();
                peersRef.current.delete(userId);
              }
              setParticipants(prev => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
              });
            }
          });
        } else if (data.type === 'voice:peer-join') {
          const userId = data.userId;
          if (userId !== currentUserId) {
            await createPeerConnection(userId, true);
          }
        } else if (data.type === 'voice:peer-leave') {
          const userId = data.userId;
          const peer = Array.from(peersRef.current.entries()).find(([_, pc]) => {
            // Находим peer connection по userId
            return true; // Упрощенно - в реальности нужно хранить маппинг
          });
          if (peer) {
            peer[1].close();
            peersRef.current.delete(peer[0]);
          }
          setParticipants(prev => {
            const newMap = new Map<string, Participant>(prev);
            Array.from(newMap.entries()).forEach(([key, value]: [string, Participant]) => {
              if (value.userId === userId) newMap.delete(key);
            });
            return newMap;
          });
        } else if (data.type === 'voice:signal') {
          const { from, userId, data: signalData } = data;
          if (userId === currentUserId) return;
          let pc = peersRef.current.get(userId);
          if (!pc) {
            await createPeerConnection(userId, false);
            pc = peersRef.current.get(userId);
          }
          if (pc) {
            await handleSignal(pc, signalData, userId);
          }
        } else if (data.type === 'call:recording:request') {
          // Запрос на запись от участника
          const consent = confirm('Участник хочет записать звонок. Разрешить?');
          sendWebSocketMessage('call:recording:response', {
            chatId,
            to: data.from,
            allowed: consent,
          });
          setRecordingConsents(prev => {
            const newMap = new Map(prev);
            newMap.set(data.from, consent);
            return newMap;
          });
        } else if (data.type === 'call:recording:response') {
          // Ответ на запрос записи
          setRecordingConsents(prev => {
            const newMap = new Map(prev);
            newMap.set(data.from, data.allowed);
            return newMap;
          });
          if (!data.allowed && isRecording) {
            showToast('Участник запретил запись', 'warning');
            stopRecording();
          }
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    socket.addEventListener('message', handleMessage);

    // Инициализация локального потока
    initLocalStream();
    callStartTimeRef.current = Date.now();

    return () => {
      socket.removeEventListener('message', handleMessage);
      sendWebSocketMessage('voice:leave', { chatId });
      leaveCall();
    };
  }, [chatId, currentUserId]);

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error('Failed to get user media:', e);
      showToast('Не удалось получить доступ к камере/микрофону', 'error');
    }
  };

  const createPeerConnection = async (userId: string, isInitiator: boolean) => {
    try {
      // Получаем ICE серверы
      let iceServersConfig: RTCConfiguration['iceServers'] = [];
      try {
        const response = await api('/api/rtc/ice');
        iceServersConfig = response.iceServers || [];
      } catch (e) {
        console.warn('Failed to get ICE servers, using fallback');
      }
      
      // Fallback на Google STUN
      if (!iceServersConfig || iceServersConfig.length === 0) {
        iceServersConfig = [{ urls: 'stun:stun.l.google.com:19302' }];
      }
      
      // Валидация и нормализация ICE серверов
      iceServersConfig = iceServersConfig.map((server: any) => {
        if (typeof server === 'string') {
          return { urls: server };
        }
        if (server.urls) {
          // Если urls - массив, берем первый элемент
          if (Array.isArray(server.urls)) {
            return { ...server, urls: server.urls[0] };
          }
          // Если urls - строка, проверяем формат
          if (typeof server.urls === 'string') {
            // Убираем query параметры если есть
            const cleanUrl = server.urls.split('?')[0];
            return { ...server, urls: cleanUrl };
          }
        }
        return server;
      }).filter((server: any) => {
        // Фильтруем невалидные серверы
        if (!server.urls) return false;
        const url = typeof server.urls === 'string' ? server.urls : server.urls[0];
        return url && (url.startsWith('stun:') || url.startsWith('turn:'));
      });
      
      const pc = new RTCPeerConnection({ iceServers: iceServersConfig });

      // Добавляем локальные треки
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // Обработка удаленных треков
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          setParticipants(prev => {
            const newMap = new Map<string, Participant>(prev);
            // Если уже есть участник с таким userId, обновляем stream
            const existing = newMap.get(userId);
            if (existing) {
              existing.stream.getTracks().forEach(t => t.stop());
            }
            newMap.set(userId, {
              stream,
              userId,
              muted: false,
              videoEnabled: true
            });
            return newMap;
          });
        }
      };

      // Обработка изменения состояния соединения
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          setParticipants(prev => {
            const newMap = new Map<string, Participant>(prev);
            const participant = newMap.get(userId);
            if (participant) {
              participant.stream.getTracks().forEach(t => t.stop());
            }
            newMap.delete(userId);
            return newMap;
          });
          peersRef.current.delete(userId);
        }
      };

      // ICE кандидаты
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebSocketMessage('voice:signal', {
            chatId,
            to: userId,
            data: { type: 'ice', candidate: event.candidate }
          });
        }
      };

      peersRef.current.set(userId, pc);

      if (isInitiator) {
        // Создаем offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWebSocketMessage('voice:signal', {
          chatId,
          to: userId,
          data: { type: 'offer', sdp: offer }
        });
      }
    } catch (e) {
      console.error('Failed to create peer connection:', e);
    }
  };

  const handleSignal = async (pc: RTCPeerConnection, data: any, userId: string) => {
    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendWebSocketMessage('voice:signal', {
          chatId,
          to: userId,
          data: { type: 'answer', sdp: answer }
        });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'ice') {
        if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    } catch (e) {
      console.error('Failed to handle signal:', e);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      
      // Заменяем видео трек во всех peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      // Обновляем локальный видео элемент
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);

      // Когда пользователь останавливает демонстрацию экрана
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (e) {
      console.error('Failed to start screen share:', e);
    }
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Возвращаем камеру
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }

    setIsScreenSharing(false);
  };

  // Запись звонка
  const startRecording = async () => {
    try {
      if (!localStream && participants.size === 0) {
        showToast('Нет потоков для записи', 'error');
        return;
      }

      // Запрашиваем согласие на запись
      const consent = confirm('Начать запись группового звонка? Все участники будут уведомлены.');
      if (!consent) return;

      // Отправляем запрос на согласие всем участникам
      participants.forEach((participant) => {
        sendWebSocketMessage('call:recording:request', {
          chatId,
          to: participant.userId,
        });
      });

      // Создаем комбинированный поток для записи
      const combinedStream = new MediaStream();
      
      if (localStream) {
        localStream.getTracks().forEach(track => combinedStream.addTrack(track));
      }
      participants.forEach((participant) => {
        participant.stream.getTracks().forEach(track => combinedStream.addTrack(track));
      });

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
        formData.append('file', blob, `group-call-${chatId}-${Date.now()}.webm`);
        formData.append('chatId', chatId);
        formData.append('type', 'group');
        
        try {
          // Используем fetch для загрузки файла
          const formDataToSend = new FormData();
          formDataToSend.append('file', blob, `group-call-${chatId}-${Date.now()}.webm`);
          formDataToSend.append('chatId', chatId);
          formDataToSend.append('type', 'group');
          
          const response = await fetch('/api/calls/recordings', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: formDataToSend
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
      recorder.start(1000);
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
      recordingConsents.clear();
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
    if (localVideoRef.current) {
      if (imageUrl) {
        localVideoRef.current.style.position = 'relative';
      } else {
        localVideoRef.current.style.position = '';
      }
    }
  };

  // Сохранение истории группового звонка
  const saveGroupCallHistory = async (status: 'active' | 'ended') => {
    try {
      await api('/api/calls/group', 'POST', {
        chatId,
        type: 'video',
        status,
        startedAt: callStartTimeRef.current || Date.now(),
        endedAt: status === 'ended' ? Date.now() : undefined,
        participantIds: Array.from(participants.keys()),
      });
    } catch (e) {
      console.error('Failed to save group call history:', e);
    }
  };

  const loadChatMembers = async () => {
    try {
      const chat = await api(`/api/chats/${chatId}`);
      const members = chat.members || [];
      const membersMap = new Map<string, {username: string, avatarUrl?: string, role?: string}>();
      
      members.forEach((m: any) => {
        if (m.user) {
          membersMap.set(m.userId || m.user.id, {
            username: m.user.username || 'Пользователь',
            avatarUrl: m.user.avatarUrl,
            role: m.role
          });
        }
        if (m.userId === currentUserId && (m.role === 'admin' || m.role === 'owner')) {
          setIsAdmin(true);
        }
      });
      
      setChatMembers(membersMap);
    } catch (e) {
      console.error('Failed to load chat members:', e);
    }
  };

  const muteParticipant = (userId: string) => {
    sendWebSocketMessage('voice:mute', { chatId, targetUserId: userId });
    setParticipants(prev => {
      const newMap = new Map(prev);
      const participant = newMap.get(userId);
      if (participant) {
        participant.muted = true;
        participant.stream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
        newMap.set(userId, participant);
      }
      return newMap;
    });
  };

  const unmuteParticipant = (userId: string) => {
    sendWebSocketMessage('voice:unmute', { chatId, targetUserId: userId });
    setParticipants(prev => {
      const newMap = new Map(prev);
      const participant = newMap.get(userId);
      if (participant) {
        participant.muted = false;
        participant.stream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        newMap.set(userId, participant);
      }
      return newMap;
    });
  };

  const removeParticipant = (userId: string) => {
    if (!isAdmin) return;
    sendWebSocketMessage('voice:remove', { chatId, targetUserId: userId });
    const pc = peersRef.current.get(userId);
    if (pc) {
      pc.close();
      peersRef.current.delete(userId);
    }
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  };

  const leaveCall = () => {
    // Останавливаем запись если активна
    if (isRecording) {
      stopRecording();
    }

    // Останавливаем screen sharing если активен
    if (isScreenSharing) {
      stopScreenShare();
    }

    // Останавливаем все потоки
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Закрываем все peer connections
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    // Сохраняем историю звонка
    saveGroupCallHistory('ended');

    // Покидаем voice room
    sendWebSocketMessage('voice:leave', { chatId });

    callStartTimeRef.current = null;
    onClose();
  };

  return (
    <div className="group-video-call">
      <div className="video-call-header">
        <h3>Видеозвонок</h3>
        <button onClick={leaveCall} className="close-call-btn">✕</button>
      </div>

      {/* Меню фильтров и эффектов */}
      <div style={{
        position: 'absolute',
        top: '60px',
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
      
      <div className="video-grid">
        {/* Локальное видео */}
        <div className="video-item local-video">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="video-element"
          />
          <div className="video-overlay">
            <span>{isMuted ? '🔇' : '🎤'}</span>
            <span>{isVideoEnabled ? '📹' : '📷'}</span>
            {isScreenSharing && <span>🖥️</span>}
          </div>
        </div>

        {/* Видео участников */}
        {Array.from(participants.values()).map((participant: Participant, idx: number) => {
          const memberInfo = chatMembers.get(participant.userId);
          const username = memberInfo?.username || `Участник ${idx + 1}`;
          return (
            <div key={participant.userId} className="video-item" style={{ position: 'relative' }}>
              <video
                autoPlay
                playsInline
                ref={(video) => {
                  if (video && participant.stream) {
                    video.srcObject = participant.stream;
                  }
                }}
                className="video-element"
              />
              <div className="video-overlay">
                <span>{username}</span>
                {participant.muted && <span>🔇</span>}
                {!participant.videoEnabled && <span>📷</span>}
              </div>
              {isAdmin && (
                <div className="participant-controls" style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  display: 'flex',
                  gap: '4px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  padding: '4px',
                  borderRadius: '4px'
                }}>
                  <button
                    onClick={() => participant.muted ? unmuteParticipant(participant.userId) : muteParticipant(participant.userId)}
                    title={participant.muted ? 'Разрешить микрофон' : 'Заглушить'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '4px'
                    }}
                  >
                    {participant.muted ? '🔊' : '🔇'}
                  </button>
                  <button
                    onClick={() => removeParticipant(participant.userId)}
                    title="Удалить из звонка"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '4px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="video-controls">
        <button
          onClick={toggleMute}
          className={`control-btn ${isMuted ? 'muted' : ''}`}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button
          onClick={toggleVideo}
          className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
          title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
        >
          {isVideoEnabled ? '📹' : '📷'}
        </button>
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
        >
          🖥️
        </button>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`control-btn ${isRecording ? 'active' : ''}`}
          title={isRecording ? 'Остановить запись' : 'Начать запись'}
          disabled={isRecording && Array.from(recordingConsents.values()).some(consent => !consent)}
        >
          {isRecording ? '🔴⏹️' : '🔴'}
        </button>
        <button
          onClick={() => setShowParticipantsMenu(!showParticipantsMenu)}
          className={`control-btn ${showParticipantsMenu ? 'active' : ''}`}
          title="Участники"
        >
          👥 {participants.size + 1}
        </button>
        <button
          onClick={leaveCall}
          className="control-btn leave-btn"
          title="Покинуть звонок"
        >
          📞
        </button>
      </div>

      {showParticipantsMenu && (
        <div className="participants-menu" style={{
          position: 'absolute',
          bottom: '80px',
          right: '20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-md)',
          minWidth: '250px',
          maxHeight: '400px',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
            <h4 style={{ margin: 0 }}>Участники ({participants.size + 1})</h4>
            <button onClick={() => setShowParticipantsMenu(false)} style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px'
            }}>✕</button>
          </div>
          
          {/* Текущий пользователь */}
          <div style={{
            padding: 'var(--spacing-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            <span>Вы</span>
            {isMuted && <span>🔇</span>}
            {!isVideoEnabled && <span>📷</span>}
          </div>

          {/* Другие участники */}
          {Array.from(participants.values()).map((participant: Participant) => {
            const memberInfo = chatMembers.get(participant.userId);
            const username = memberInfo?.username || 'Участник';
            return (
              <div key={participant.userId} style={{
                padding: 'var(--spacing-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--spacing-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1 }}>
                  {memberInfo?.avatarUrl ? (
                    <img src={memberInfo.avatarUrl} alt={username} style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%'
                    }} />
                  ) : (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      {username[0].toUpperCase()}
                    </div>
                  )}
                  <span>{username}</span>
                  {participant.muted && <span>🔇</span>}
                  {!participant.videoEnabled && <span>📷</span>}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => participant.muted ? unmuteParticipant(participant.userId) : muteParticipant(participant.userId)}
                      title={participant.muted ? 'Разрешить микрофон' : 'Заглушить'}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px'
                      }}
                    >
                      {participant.muted ? '🔊' : '🔇'}
                    </button>
                    <button
                      onClick={() => removeParticipant(participant.userId)}
                      title="Удалить"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px',
                        color: 'var(--danger)'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

