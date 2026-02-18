/**
 * Список голосовых каналов в стиле Discord: иконка динамика, название, счётчик участников.
 * При клике — выбор канала (подключение обрабатывается снаружи).
 */
import React from 'react';
import type { VoiceChannel } from '../../types/voice';

export interface VoiceChannelListProps {
  channels: VoiceChannel[];
  selectedChannelId: string | null;
  /** channelId -> список userId в канале (для счётчика) */
  voiceState?: Record<string, string[]>;
  onSelectChannel: (channel: VoiceChannel) => void;
}

export default function VoiceChannelList({
  channels,
  selectedChannelId,
  voiceState = {},
  onSelectChannel,
}: VoiceChannelListProps) {
  if (channels.length === 0) {
    return (
      <div style={{ padding: 8, color: 'var(--text-secondary)', fontSize: 13, fontStyle: 'italic' }}>
        Нет голосовых каналов
      </div>
    );
  }

  return (
    <div className="voice-channel-list" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {channels.map((channel) => {
        const inChannel = voiceState[channel.id] || [];
        const count = inChannel.length;
        const isSelected = selectedChannelId === channel.id;

        return (
          <button
            key={channel.id}
            type="button"
            onClick={() => onSelectChannel(channel)}
            className="voice-channel-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              background: isSelected ? 'var(--accent-primary)' : count > 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: isSelected ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              fontSize: 14,
            }}
          >
            <span style={{ fontSize: 16 }}>🔊</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel.name}</span>
            {count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  background: isSelected ? 'rgba(255,255,255,0.3)' : 'var(--accent-primary)',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 10,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
