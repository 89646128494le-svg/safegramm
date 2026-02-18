/**
 * Карточка участника голосового канала: аватар, имя, индикатор «говорения» (зелёная обводка), мут.
 */
import React from 'react';
import type { VoiceParticipantInfo } from '../../types/voice';

export interface VoiceParticipantProps {
  participant: VoiceParticipantInfo;
  isCurrentUser?: boolean;
}

export default function VoiceParticipant({ participant, isCurrentUser }: VoiceParticipantProps) {
  const { userId, username, avatarUrl, isMuted, isSpeaking } = participant;
  const displayName = username || (isCurrentUser ? 'Вы' : userId.slice(0, 8));
  const initial = (username || userId).slice(0, 1).toUpperCase();

  return (
    <div
      className="voice-participant"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        background: isSpeaking ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255,255,255,0.04)',
        marginBottom: 4,
        border: isSpeaking ? '2px solid var(--voice-speaking, #22c55e)' : '2px solid transparent',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div
        className="voice-participant-avatar"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          border: isSpeaking ? '2px solid var(--voice-speaking, #22c55e)' : '2px solid transparent',
          boxSizing: 'border-box',
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-primary, #6366f1)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {initial}
          </div>
        )}
      </div>
      <span className="voice-participant-name" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14, fontWeight: 500 }}>
        {displayName}
      </span>
      {isMuted && (
        <span title="Микрофон выключен" style={{ fontSize: 14, opacity: 0.9 }}>
          🔇
        </span>
      )}
    </div>
  );
}
