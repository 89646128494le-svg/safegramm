/**
 * Типы для системы голосовых каналов (Discord-style).
 */

export interface VoiceChannel {
  id: string;
  serverId: string;
  name: string;
  type: 'voice';
  chatId?: string;
  position: number;
}

export interface VoiceParticipantInfo {
  userId: string;
  username?: string;
  avatarUrl?: string;
  isMuted: boolean;
  isDeafened?: boolean;
  isSpeaking: boolean;
}

export interface UseVoiceChatOptions {
  chatId: string;
  currentUserId: string;
  /** При первом монтировании сразу подключаться */
  autoJoin?: boolean;
}

export interface UseVoiceChatReturn {
  participants: VoiceParticipantInfo[];
  isConnected: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isConnecting: boolean;
  error: string | null;
  /** Удалённые потоки демонстрации экрана: userId -> MediaStream */
  remoteScreenStreams: Record<string, MediaStream>;
  join: () => Promise<void>;
  leave: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  /** Установить локальный поток экрана (добавляется в peer connections и рассылается) */
  setScreenStream: (stream: MediaStream | null) => void;
}
