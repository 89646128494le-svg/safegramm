/**
 * Полноценный вид голосового канала: список участников с индикатором «говорения» и панель управления.
 * Использует useVoiceChat; при клике на канал снаружи передаётся autoJoin.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { sendWebSocketMessage } from '../../services/websocket';
import VoiceParticipant from './VoiceParticipant';
import VoiceControlBar from './VoiceControlBar';

function ScreenShareVideo({ displayStream, muted }: { displayStream: MediaStream | null; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = displayStream;
  }, [displayStream]);
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}

export interface VoiceChannelViewProps {
  chatId: string;
  channelName: string;
  currentUserId: string;
  /** Подключиться при монтировании */
  autoJoin?: boolean;
  /** userId -> { username, avatarUrl } для отображения имён */
  membersMap?: Map<string, { username: string; avatarUrl?: string }>;
}

export default function VoiceChannelView({
  chatId,
  channelName,
  currentUserId,
  autoJoin = false,
  membersMap = new Map(),
}: VoiceChannelViewProps) {
  const {
    participants,
    isConnected,
    isMuted,
    isDeafened,
    isConnecting,
    error,
    remoteScreenStreams,
    join,
    leave,
    setMuted,
    setDeafened,
    setScreenStream,
  } = useVoiceChat({ chatId, currentUserId, autoJoin });

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localScreenStreamRef = useRef<MediaStream | null>(null);

  const stopScreenShare = useCallback(() => {
    localScreenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localScreenStreamRef.current = null;
    setScreenStream(null);
    sendWebSocketMessage('voice:screen-stop', { chatId });
    setIsScreenSharing(false);
  }, [chatId, setScreenStream]);

  const toggleScreenShare = useCallback(async () => {
    if (!isConnected) return;
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      localScreenStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      setScreenStream(stream);
      sendWebSocketMessage('voice:screen-start', { chatId });
      setIsScreenSharing(true);
    } catch (e) {
      console.error('Screen share:', e);
    }
  }, [isConnected, isScreenSharing, chatId, stopScreenShare, setScreenStream]);

  const handleLeave = useCallback(() => {
    stopScreenShare();
    leave();
  }, [stopScreenShare, leave]);

  const activeScreenStream = isScreenSharing ? localScreenStreamRef.current : null;
  const activeScreenUserId = isScreenSharing ? currentUserId : (Object.keys(remoteScreenStreams)[0] ?? null);
  const activeRemoteStream = activeScreenUserId && !isScreenSharing ? remoteScreenStreams[activeScreenUserId] : null;
  const displayStream = activeScreenStream ?? activeRemoteStream ?? null;
  const displayName = activeScreenUserId
    ? (activeScreenUserId === currentUserId ? 'Вы' : membersMap.get(activeScreenUserId)?.username ?? activeScreenUserId)
    : '';

  const participantsWithNames = participants.map((p) => ({
    ...p,
    username: membersMap.get(p.userId)?.username ?? p.username,
    avatarUrl: membersMap.get(p.userId)?.avatarUrl ?? p.avatarUrl,
  }));

  if (!chatId) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)' }}>У голосового канала нет привязки к чату</div>
    );
  }

  return (
    <div
      className="voice-channel-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--bg-card)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🔊</span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{channelName}</h3>
        </div>
      </div>

      {!isConnected && !isConnecting && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            padding: 24,
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>
            Подключитесь к голосовому каналу, чтобы говорить с участниками.
          </p>
          <button type="button" onClick={() => join()} className="btn btn-primary" style={{ padding: '12px 24px' }}>
            Подключиться
          </button>
        </div>
      )}

      {isConnecting && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {error && (
        <div style={{ padding: 16, color: 'var(--danger, #ef4444)', fontSize: 14 }}>{error}</div>
      )}

      {isConnected && (
        <>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {displayStream ? (
              <div className="voice-screen-share-view" style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-primary, #1a1a2e)',
                borderRadius: 12,
                overflow: 'hidden',
                margin: 12,
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  background: 'rgba(0,0,0,0.35)',
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  flexShrink: 0,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    ИСТОЧНИК В ЭФИРЕ
                  </span>
                </div>
                <div style={{
                  flex: 1,
                  minHeight: 0,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0d0d12',
                }}>
                  <ScreenShareVideo displayStream={displayStream} muted={isScreenSharing} />
                </div>
                <div style={{
                  padding: '10px 16px',
                  background: 'rgba(0,0,0,0.25)',
                  borderTop: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'var(--accent, #5865f2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#fff',
                  }}>
                    {displayName.slice(0, 1).toUpperCase() || '?'}
                  </span>
                  {displayName}
                </div>
              </div>
            ) : null}
            <div
              style={{
                flex: displayStream ? 0 : 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                Участники ({participantsWithNames.length})
              </div>
              {participantsWithNames.length === 0 ? (
                <div style={{ padding: 12, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
                  Нет участников в канале
                </div>
              ) : (
                participantsWithNames.map((p) => (
                  <VoiceParticipant
                    key={p.userId}
                    participant={p}
                    isCurrentUser={p.userId === currentUserId}
                  />
                ))
              )}
            </div>
          </div>
          <VoiceControlBar
            isMuted={isMuted}
            isDeafened={isDeafened}
            isScreenSharing={isScreenSharing}
            onMuteToggle={() => setMuted(!isMuted)}
            onDeafenToggle={() => setDeafened(!isDeafened)}
            onScreenShareToggle={toggleScreenShare}
            onLeave={handleLeave}
          />
        </>
      )}
    </div>
  );
}
