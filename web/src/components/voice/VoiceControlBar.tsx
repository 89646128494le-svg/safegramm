/**
 * Нижняя панель управления голосовым каналом: мут, наушники (deafen), демонстрация экрана, покинуть канал.
 */
import React from 'react';

export interface VoiceControlBarProps {
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing?: boolean;
  onMuteToggle: () => void;
  onDeafenToggle: () => void;
  onScreenShareToggle?: () => void;
  onLeave: () => void;
  disabled?: boolean;
}

export default function VoiceControlBar({
  isMuted,
  isDeafened,
  isScreenSharing = false,
  onMuteToggle,
  onDeafenToggle,
  onScreenShareToggle,
  onLeave,
  disabled = false,
}: VoiceControlBarProps) {
  return (
    <div
      className="voice-control-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onMuteToggle}
        disabled={disabled}
        title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 8,
          border: 'none',
          background: isMuted ? 'rgba(239, 68, 68, 0.25)' : 'var(--bg-card)',
          color: isMuted ? '#fca5a5' : 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 18,
        }}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>
      <button
        type="button"
        onClick={onDeafenToggle}
        disabled={disabled}
        title={isDeafened ? 'Включить звук' : 'Отключить звук (наушники)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 8,
          border: 'none',
          background: isDeafened ? 'rgba(239, 68, 68, 0.25)' : 'var(--bg-card)',
          color: isDeafened ? '#fca5a5' : 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 18,
        }}
      >
        {isDeafened ? '🔇' : '🔊'}
      </button>
      {onScreenShareToggle && (
        <button
          type="button"
          onClick={onScreenShareToggle}
          disabled={disabled}
          title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 8,
            border: 'none',
            background: isScreenSharing ? 'rgba(239, 68, 68, 0.25)' : 'var(--bg-card)',
            color: isScreenSharing ? '#fca5a5' : 'var(--text-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 18,
          }}
        >
          🖥️
        </button>
      )}
      <button
        type="button"
        onClick={onLeave}
        disabled={disabled}
        title="Покинуть канал"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          border: 'none',
          background: 'rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Покинуть канал
      </button>
    </div>
  );
}
