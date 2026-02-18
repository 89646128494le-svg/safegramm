/**
 * Панель голосового канала: мут, демонстрация экрана. Основной экран фиксирован, скролл только у списка участников.
 */
import React, { useEffect, useState, useRef } from 'react';
import { getSocket, sendWebSocketMessage } from '../services/websocket';

interface VoiceChannelPanelProps {
  chatId: string;
  channelName: string;
  currentUserId: string;
  autoJoin?: boolean;
}

export default function VoiceChannelPanel({
  chatId,
  channelName,
  currentUserId,
  autoJoin = false,
}: VoiceChannelPanelProps) {
  const [joined, setJoined] = useState(autoJoin);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const joinedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  joinedRef.current = joined;

  useEffect(() => {
    if (!chatId) return;
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'voice:participants' && data.chatId === chatId && Array.isArray(data.members)) {
          setParticipantIds(data.members);
        }
      } catch {}
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.removeEventListener('message', handleMessage);
      if (joinedRef.current) sendWebSocketMessage('voice:leave', { chatId });
    };
  }, [chatId]);

  useEffect(() => {
    if (joined && chatId) sendWebSocketMessage('voice:join', { chatId });
  }, [joined, chatId]);

  const handleJoin = () => {
    setJoined(true);
    sendWebSocketMessage('voice:join', { chatId });
  };

  const handleLeave = () => {
    stopScreenShare();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    sendWebSocketMessage('voice:leave', { chatId });
    setJoined(false);
    setParticipantIds([]);
    setIsMuted(false);
    setIsScreenSharing(false);
  };

  const toggleMute = async () => {
    if (!joined) return;
    try {
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
      }
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        const nextMuted = !isMuted;
        track.enabled = !nextMuted;
        sendWebSocketMessage('voice:mute', { chatId, muted: nextMuted });
        setIsMuted(nextMuted);
      }
    } catch (e) {
      console.error('Microphone access:', e);
    }
  };

  function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    sendWebSocketMessage('voice:screen-stop', { chatId });
    setIsScreenSharing(false);
  }

  const toggleScreenShare = async () => {
    if (!joined) return;
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      sendWebSocketMessage('voice:screen-start', { chatId });
      setIsScreenSharing(true);
    } catch (e) {
      console.error('Screen share:', e);
    }
  };

  const panelStyle: React.CSSProperties = {
    padding: 24,
    background: 'var(--panel, rgba(31, 41, 55, 0.6))',
    borderRadius: 12,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
        <span style={{ fontSize: 24 }}>🔊</span>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{channelName}</h3>
      </div>
      {!joined ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, minHeight: 200, justifyContent: 'center' }}>
          <p style={{ margin: 0, color: 'var(--subtle, #9ca3af)', fontSize: 14, textAlign: 'center' }}>
            Подключитесь к голосовому каналу, чтобы говорить с участниками.
          </p>
          <button type="button" onClick={handleJoin} className="btn btn-primary" style={{ padding: '12px 24px' }}>
            Подключиться
          </button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: 'var(--accent, #3b82f6)', flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              Вы в канале
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="small" style={{ color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11, marginBottom: 8, flexShrink: 0 }}>
                Участники ({participantIds.length})
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {participantIds.length === 0 ? (
                  <li style={{ padding: 12, color: 'var(--subtle)', fontStyle: 'italic', fontSize: 13 }}>Нет участников в канале</li>
                ) : (
                  participantIds.map((id) => (
                    <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginBottom: 4 }}>
                      <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                        {id === currentUserId ? 'Вы' : id.slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{ fontSize: 14 }}>{id === currentUserId ? 'Вы' : id}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--border, #374151)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={toggleMute}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              className="btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: isMuted ? 'rgba(239,68,68,0.2)' : undefined }}
            >
              {isMuted ? '🔇' : '🎤'} {isMuted ? 'Вкл. микрофон' : 'Мут'}
            </button>
            <button
              type="button"
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
              className="btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: isScreenSharing ? 'rgba(239,68,68,0.2)' : undefined }}
            >
              🖥️ {isScreenSharing ? 'Стоп' : 'Экран'}
            </button>
            <button type="button" onClick={handleLeave} className="btn" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
              Выйти из канала
            </button>
          </div>
        </>
      )}
    </div>
  );
}
