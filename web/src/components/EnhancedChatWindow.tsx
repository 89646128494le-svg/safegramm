
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api, getApiBaseUrl, getErrorMessage } from '../services/api';
import { getSocket, sendWebSocketMessage, closeSocket } from '../services/websocket';
import { notifyNewMessage, notifyCall, hasNotificationPermission } from '../services/notifications';
import { useStore } from '../store/useStore';
import { parseMarkdown, isVideoUrl } from '../utils/markdown';
import { exportChatToJSON, exportChatToTXT } from '../utils/exportChat';
import ExportChatDialog from './ExportChatDialog';
import ChatStatistics from './ChatStatistics';
import BackupManager from './BackupManager';
import BotManager from './BotManager';
import CalendarIntegration from './CalendarIntegration';
import TodoIntegration from './TodoIntegration';
import { addToOfflineQueue, isOnline, onOnlineStatusChange, processOfflineQueue, removeFromOfflineQueue } from '../services/offlineQueue';
import { sendWebSocketMessage as sendOptimized, flushWebSocketBatch } from '../services/websocketOptimized';
import { compressImage, shouldCompressImage } from '../utils/imageCompression';
import LinkPreview from './LinkPreview';
import VideoEmbed from './VideoEmbed';
import Poll from './Poll';
import MessagePreview from './MessagePreview';
import CallHistory from './CallHistory';
import { 
  generateGroupKey, 
  wrapKeyForUser, 
  unwrapKeyFromEnvelope, 
  encryptPlaintext, 
  decryptCiphertext,
  getMyPublicJwk,
  exportRawKey,
  importRawKey
} from '../services/crypto';
import MentionAutocomplete from './MentionAutocomplete';
import GroupVideoCall from './GroupVideoCall';
import DMCall from './DMCall';
import EmojiPicker from './EmojiPicker';
import MediaGallery from './MediaGallery';
import UserProfile from './UserProfile';
import StickerPicker from './StickerPicker';
import GifPicker from './GifPicker';
import LocationPicker from './LocationPicker';
import GroupChannelSettings from './GroupChannelSettings';
import AudioPlayer from './AudioPlayer';
import { showToast } from './Toast';
import { ConfirmModal, PromptModal } from './Modal';
import { getChatBackground, getChatColor } from '../services/appearance';
import AppearanceSettings from './AppearanceSettings';
import { UsernameWithRole } from './RoleBadge';
import { decryptVaultBlob, encryptFileForVault, saveVaultRecord, VaultEnvelope } from '../services/vault';

const MAX_MESSAGE_LENGTH = 4096;

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  ciphertext?: string;
  attachmentUrl?: string;
  replyTo?: string;
  replyToMessage?: {
    id: string;
    text: string;
    senderId: string;
    sender?: {
      id: string;
      username: string;
      avatarUrl?: string;
    };
  };
  pollId?: string;
  poll?: {
    id: string;
    question: string;
    options: Array<{ id: string; text: string; votes: number; voters: string[] }>;
    totalVotes: number;
  };
  calendarEvent?: {
    title: string;
    startTime: string;
    endTime?: string;
    location?: string;
    description?: string;
  };
  contact?: {
    name: string;
    phone?: string;
    email?: string;
    avatar?: string;
  };
  document?: {
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
    vault?: VaultEnvelope;
  };
  editHistory?: Array<{
    text: string;
    editedAt: number;
  }>;
  uploadProgress?: number;
  forwardFrom?: string;
  forwardFromChatId?: string;
  forwardedMessage?: {
    id: string;
    text: string;
    senderId: string;
    sender?: {
      id: string;
      username: string;
      avatarUrl?: string;
    };
    attachmentUrl?: string;
    createdAt: number;
  };
  threadId?: string;
  stickerId?: string;
  editedAt?: number;
  deletedAt?: number;
  expiresAt?: number;
  createdAt: number;
  /** Ð”Ð»Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð¾ÑÑ‚ÑŒ Ð³Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ð³Ð¾/Ð°ÑƒÐ´Ð¸Ð¾ Ð²Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ Ð² ÑÐµÐºÑƒÐ½Ð´Ð°Ñ… (ÐµÑÐ»Ð¸ ÐµÑÑ‚ÑŒ Ñ Ð±ÑÐºÐµÐ½Ð´Ð°). */
  attachmentDuration?: number;
  isRead?: boolean; // ÐŸÑ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð½Ð¾ Ð»Ð¸ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ñ‚ÐµÐºÑƒÑ‰Ð¸Ð¼ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÐµÐ¼
  readReceipts?: Array<{ // Ð¡Ð¿Ð¸ÑÐ¾Ðº Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÐµÐ¹, Ð¿Ñ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð²ÑˆÐ¸Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ
    userId: string;
    readAt: number;
    user?: {
      id: string;
      username: string;
      avatarUrl?: string;
    };
  }>;
  gifUrl?: string;
  sending?: boolean;
}

interface Sticker {
  id: string;
  packId: string;
  emoji: string;
  url: string;
  width: number;
  height: number;
}

interface StickerPack {
  id: string;
  name: string;
  title: string;
  thumbnailUrl?: string;
  isAnimated: boolean;
  stickerCount?: number;
}

interface Thread {
  id: string;
  chatId: string;
  rootMessageId: string;
  name: string;
  createdAt: number;
  messageCount?: number;
  lastMessage?: Message;
  unreadCount?: number;
}

interface Chat {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name?: string;
  members: string[];
  lastMessage?: Message;
}

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: string;
  roles?: string[] | string;
}

export interface ServerRoleBadge {
  id: string;
  name: string;
  color: string;
}

interface EnhancedChatWindowProps {
  chatId: string;
  currentUser: User;
  onClose?: () => void;
  onBack?: () => void;
  chatMembers?: string[];
  onMarkAsRead?: () => void;
  /** Map userId -> server role badges (for server channel chat) */
  serverMemberRoles?: Record<string, ServerRoleBadge[]>;
}

// Ð¤ÑƒÐ½ÐºÑ†Ð¸Ñ Ð´Ð»Ñ Ð²Ð¾ÑÐ¿Ñ€Ð¾Ð¸Ð·Ð²ÐµÐ´ÐµÐ½Ð¸Ñ Ð·Ð²ÑƒÐºÐ° ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
const playMessageSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    console.warn('Failed to play message sound:', e);
  }
};

// Ð¤ÑƒÐ½ÐºÑ†Ð¸Ñ Ð´Ð»Ñ Ð²Ð¾ÑÐ¿Ñ€Ð¾Ð¸Ð·Ð²ÐµÐ´ÐµÐ½Ð¸Ñ Ð·Ð²ÑƒÐºÐ° Ð·Ð²Ð¾Ð½ÐºÐ°
const playCallSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Failed to play call sound:', e);
  }
};

export default function EnhancedChatWindow({ chatId, currentUser, onClose, onBack, chatMembers, onMarkAsRead, serverMemberRoles }: EnhancedChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [lastSentMessage, setLastSentMessage] = useState<{id: string, timestamp: number} | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Map<string, Array<{userId: string, emoji: string}>>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<{query: string, position: number} | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [inGroupCall, setInGroupCall] = useState(false);
  const [groupCallVoiceOnly, setGroupCallVoiceOnly] = useState(false);
  const [inDMCall, setInDMCall] = useState<{isVideo: boolean, otherUserId: string, isIncoming?: boolean, offerData?: any} | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showThreads, setShowThreads] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Map<string, Sticker>>(new Map());
  const [savedMessages, setSavedMessages] = useState<Set<string>>(new Set());
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showExpirePicker, setShowExpirePicker] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showCalendarCreator, setShowCalendarCreator] = useState(false);
  const [showContactCreator, setShowContactCreator] = useState(false);
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<string | undefined>();
  const [selectedExpireTime, setSelectedExpireTime] = useState<number | null>(null);
  const [groupKey, setGroupKey] = useState<CryptoKey | null>(null);
  const [groupKeyVersion, setGroupKeyVersion] = useState<number>(0);
  const [isE2EEEnabled, setIsE2EEEnabled] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<{open: boolean, messageId: string, deleteForAll: boolean}>({
    open: false,
    messageId: '',
    deleteForAll: false
  });
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [threadRootMessageId, setThreadRootMessageId] = useState<string>('');
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [forwardComment, setForwardComment] = useState('');
  const [availableChats, setAvailableChats] = useState<Array<{id: string, name: string, type: string}>>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [isChatOwner, setIsChatOwner] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false);
  const [messageIdWithActions, setMessageIdWithActions] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [showBotManager, setShowBotManager] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTodos, setShowTodos] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<{
    soundEnabled: boolean;
    desktopEnabled: boolean;
    soundVolume: number;
    soundType: 'default' | 'gentle' | 'classic' | 'modern' | 'soft' | 'alert' | 'bell' | 'chime' | 'pop' | 'ding' | 'whoosh' | 'bubble';
    soundMessage?: string;
    soundCall?: string;
    soundMention?: string;
    soundGroup?: string;
    soundChannel?: string;
    volumeMessage?: number;
    volumeCall?: number;
    volumeMention?: number;
    volumeGroup?: number;
    volumeChannel?: number;
    dndEnabled?: boolean;
    dndStart?: string;
    dndEnd?: string;
  }>({
    soundEnabled: true,
    desktopEnabled: true,
    soundVolume: 80,
    soundType: 'default'
  });
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const chatInfoRef = useRef<{members: string[], type: string, name?: string} | null>(null);
  const groupInitInFlightRef = useRef<string | null>(null);
  const onceToastKeysRef = useRef<Set<string>>(new Set());
  const incomingCallTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { ui, maintenance } = useStore();

  const shouldShowOnceToast = useCallback((storageKey: string) => {
    if (onceToastKeysRef.current.has(storageKey)) return false;
    try {
      if (localStorage.getItem(storageKey) === '1') {
        onceToastKeysRef.current.add(storageKey);
        return false;
      }
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore storage failures, keep in-memory dedupe
    }
    onceToastKeysRef.current.add(storageKey);
    return true;
  }, []);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð½Ð°ÑÑ‚Ñ€Ð¾ÐµÐº ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ð¹
  const loadNotificationSettings = useCallback(async () => {
    try {
      const notifData = await api('/api/users/me/notifications');
      setNotificationSettings({
        soundEnabled: notifData.soundEnabled !== false,
        desktopEnabled: notifData.desktopEnabled !== false,
        soundVolume: notifData.soundVolume || 80,
        soundType: notifData.soundType || 'default',
        soundMessage: notifData.soundMessage,
        soundCall: notifData.soundCall,
        soundMention: notifData.soundMention,
        soundGroup: notifData.soundGroup,
        soundChannel: notifData.soundChannel,
        volumeMessage: notifData.volumeMessage,
        volumeCall: notifData.volumeCall,
        volumeMention: notifData.volumeMention,
        volumeGroup: notifData.volumeGroup,
        volumeChannel: notifData.volumeChannel,
        dndEnabled: notifData.dndEnabled,
        dndStart: notifData.dndStart,
        dndEnd: notifData.dndEnd,
      });
    } catch (e) {
      console.log('Notification settings not found, using defaults');
    }
  }, []);

  // ÐžÑ‚ÑÐ»ÐµÐ¶Ð¸Ð²Ð°Ð½Ð¸Ðµ Ð²Ð¸Ð´Ð¸Ð¼Ð¾ÑÑ‚Ð¸ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÐµÐ¹
  const loadUsers = useCallback(async () => {
    try {
      const data = await api('/api/users');
      const usersMap = new Map<string, User>();
      data.users?.forEach((u: User) => usersMap.set(u.id, u));
      setUsers(usersMap);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  }, []);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð¸Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸Ð¸ Ð¾ Ñ‡Ð°Ñ‚Ðµ
  // Ð˜Ð½Ð¸Ñ†Ð¸Ð°Ð»Ð¸Ð·Ð°Ñ†Ð¸Ñ Ð³Ñ€ÑƒÐ¿Ð¿Ð¾Ð²Ð¾Ð³Ð¾ E2EE ÐºÐ»ÑŽÑ‡Ð°
  const initializeGroupE2EE = useCallback(async () => {
    if (!chatId || !chatInfoRef.current) return;
    if (chatInfoRef.current.type !== 'group' && chatInfoRef.current.type !== 'channel') return;
    if (groupInitInFlightRef.current === chatId) return;
    
    groupInitInFlightRef.current = chatId;
    try {
      // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð²ÐµÑ€ÑÐ¸ÑŽ ÐºÐ»ÑŽÑ‡Ð°
      const versionData = await api(`/api/chats/${chatId}/group-key/version`);
      const serverVersion = versionData.keyVersion || 0;
      
      if (serverVersion === 0) {
        // ÐšÐ»ÑŽÑ‡Ð° Ð½ÐµÑ‚ - Ð½ÑƒÐ¶Ð½Ð¾ Ð¸Ð½Ð¸Ñ†Ð¸Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ (Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð´Ð»Ñ owner/admin)
        const chatData = await api(`/api/chats/${chatId}`);
        const isOwnerOrAdmin = chatData.members?.find((m: any) => 
          m.userId === currentUser.id && (m.role === 'owner' || m.role === 'admin')
        );
        
        if (!isOwnerOrAdmin) {
          setIsE2EEEnabled(false);
          return; // ÐÐµ owner/admin - Ð½Ðµ Ð¼Ð¾Ð¶ÐµÐ¼ Ð¸Ð½Ð¸Ñ†Ð¸Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ
        }
        
        // Ð“ÐµÐ½ÐµÑ€Ð¸Ñ€ÑƒÐµÐ¼ Ð³Ñ€ÑƒÐ¿Ð¿Ð¾Ð²Ð¾Ð¹ ÐºÐ»ÑŽÑ‡
        const newGroupKey = await generateGroupKey();
        
        // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ñ‹Ðµ ÐºÐ»ÑŽÑ‡Ð¸ Ð²ÑÐµÑ… ÑƒÑ‡Ð°ÑÑ‚Ð½Ð¸ÐºÐ¾Ð²
        const wrappedKeys: Record<string, string> = {};
        for (const memberId of chatInfoRef.current.members) {
          const uid = typeof memberId === 'string' ? memberId : (memberId as any)?.userId ?? (memberId as any)?.id;
          if (!uid) continue;
          try {
            const userKey = await api(`/api/users/${uid}/public_key`);
            if (userKey.publicKeyJwk) {
              const wrapped = await wrapKeyForUser(newGroupKey, userKey.publicKeyJwk, chatId);
              wrappedKeys[uid] = wrapped;
            }
          } catch (e) {
            console.warn(`Failed to get key for user ${uid}:`, e);
          }
        }
        
        // ÐžÑ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ Ð½Ð° ÑÐµÑ€Ð²ÐµÑ€
        await api(`/api/chats/${chatId}/group-key/init`, 'POST', { wrappedKeys });
        setGroupKey(newGroupKey);
        setGroupKeyVersion(1);
        setIsE2EEEnabled(true);
        if (shouldShowOnceToast(`safegram_group_e2ee_notice_${chatId}`)) {
          showToast('E2EE для группы инициализирован', 'success');
        }
      } else {
        // ÐšÐ»ÑŽÑ‡ ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÐµÑ‚ - Ð·Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ ÐµÐ³Ð¾
        await loadGroupKey();
      }
    } catch (e: any) {
      console.error('Failed to initialize group E2EE:', e);
      setIsE2EEEnabled(false);
    } finally {
      if (groupInitInFlightRef.current === chatId) {
        groupInitInFlightRef.current = null;
      }
    }
  }, [chatId, currentUser.id, shouldShowOnceToast]);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð³Ñ€ÑƒÐ¿Ð¿Ð¾Ð²Ð¾Ð³Ð¾ ÐºÐ»ÑŽÑ‡Ð°
  const loadGroupKey = useCallback(async (): Promise<CryptoKey | null> => {
    if (!chatId) return null;
    
    try {
      const keyData = await api(`/api/chats/${chatId}/group-key`);
      if (keyData.wrappedKey) {
        const createdBy = keyData.createdBy != null ? String(keyData.createdBy) : '';
        if (!createdBy) return null;
        const creatorKey = await api(`/api/users/${createdBy}/public_key`);
        if (creatorKey.publicKeyJwk) {
          const unwrappedKey = await unwrapKeyFromEnvelope(keyData.wrappedKey, creatorKey.publicKeyJwk, chatId);
          setGroupKey(unwrappedKey);
          setGroupKeyVersion(keyData.keyVersion || 0);
          setIsE2EEEnabled(true);
          return unwrappedKey;
        }
      }
    } catch (e: any) {
      if (e.message?.includes('key_not_found')) {
        // ÐšÐ»ÑŽÑ‡Ð° Ð½ÐµÑ‚ - Ð¿Ð¾Ð¿Ñ€Ð¾Ð±ÑƒÐµÐ¼ Ð¸Ð½Ð¸Ñ†Ð¸Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ
        await initializeGroupE2EE();
      } else {
        console.error('Failed to load group key:', e);
        setIsE2EEEnabled(false);
      }
    }
    return null;
  }, [chatId, initializeGroupE2EE]);

  // ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ Ð³Ñ€ÑƒÐ¿Ð¿Ð¾Ð²Ð¾Ð³Ð¾ ÐºÐ»ÑŽÑ‡Ð° (Ð¿Ñ€Ð¸ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ð¸ ÑÐ¾ÑÑ‚Ð°Ð²Ð°)
  const updateGroupKey = useCallback(async () => {
    if (!chatId || !chatInfoRef.current) return;
    
    try {
      const newGroupKey = await generateGroupKey();
      
      // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ñ‹Ðµ ÐºÐ»ÑŽÑ‡Ð¸ Ð²ÑÐµÑ… ÑƒÑ‡Ð°ÑÑ‚Ð½Ð¸ÐºÐ¾Ð²
      const wrappedKeys: Record<string, string> = {};
      for (const memberId of chatInfoRef.current.members) {
        const uid = typeof memberId === 'string' ? memberId : (memberId as any)?.userId ?? (memberId as any)?.id;
        if (!uid) continue;
        try {
          const userKey = await api(`/api/users/${uid}/public_key`);
          if (userKey.publicKeyJwk) {
            const wrapped = await wrapKeyForUser(newGroupKey, userKey.publicKeyJwk, chatId);
            wrappedKeys[uid] = wrapped;
          }
        } catch (e) {
          console.warn(`Failed to get key for user ${uid}:`, e);
        }
      }
      
      await api(`/api/chats/${chatId}/group-key/update`, 'POST', { wrappedKeys });
      setGroupKey(newGroupKey);
      setGroupKeyVersion(prev => prev + 1);
      showToast('Ð“Ñ€ÑƒÐ¿Ð¿Ð¾Ð²Ð¾Ð¹ ÐºÐ»ÑŽÑ‡ Ð¾Ð±Ð½Ð¾Ð²Ð»Ñ‘Ð½ (forward secrecy)', 'success');
    } catch (e: any) {
      console.error('Failed to update group key:', e);
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ð±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ ÐºÐ»ÑŽÑ‡ ÑˆÐ¸Ñ„Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ.'), 'error');
    }
  }, [chatId]);

  const loadChatInfo = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const chats = await api('/api/chats');
      const chat = chats.chats?.find((c: any) => c.id === chatId);
      if (chat) {
        const rawMembers = chat.members || [];
        const memberIds: string[] = rawMembers.map((m: any) =>
          typeof m === 'string' ? m : (m.userId ?? m.id ?? m?.user?.id ?? '')
        ).filter(Boolean);
        let displayName = chat.name;
        if ((chat.type || 'dm') === 'dm') {
          const otherMember = rawMembers.find((m: any) => {
            const uid = typeof m === 'string' ? m : (m.userId ?? m?.user?.id);
            return uid && uid !== currentUser.id;
          });
          const otherUsername = otherMember && typeof otherMember === 'object' && otherMember.user?.username
            ? otherMember.user.username
            : '';
          displayName = otherUsername || chat.name || '';
        }
        chatInfoRef.current = { members: memberIds, type: chat.type || 'dm', name: displayName || chat.name };
        
        // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð¿Ñ€Ð°Ð²Ð° Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ
        if (chat.members && Array.isArray(chat.members)) {
          const currentMember = chat.members.find((m: any) => m.userId === currentUser.id);
          setIsChatOwner(currentMember?.role === 'owner');
        }
        
        // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, ÑÐ²Ð»ÑÐµÑ‚ÑÑ Ð»Ð¸ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ Ð°Ð´Ð¼Ð¸Ð½Ð¾Ð¼ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹
        const userRoles = Array.isArray(currentUser.roles) ? currentUser.roles : 
                         (currentUser.roles ? String(currentUser.roles).split(',').map((r: string) => r.trim()) : []);
        setIsPlatformAdmin(userRoles.includes('admin') || userRoles.includes('owner'));
      }
    } catch (e) {
      console.error('Failed to load chat info:', e);
    }
  }, [chatId, currentUser?.id, currentUser?.roles]);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ñ Ð¿Ð°Ð³Ð¸Ð½Ð°Ñ†Ð¸ÐµÐ¹
  const loadMessages = useCallback(async (beforeId?: string, append: boolean = false) => {
    if (!chatId) return;
    const url = selectedThreadId 
      ? `/api/threads/${selectedThreadId}/messages`
      : `/api/chats/${chatId}/messages`;
    
    try {
      // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð¿Ð°Ñ€Ð°Ð¼ÐµÑ‚Ñ€Ñ‹ Ð¿Ð°Ð³Ð¸Ð½Ð°Ñ†Ð¸Ð¸
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (beforeId) {
        params.append('before', beforeId);
      }
      
      const data = await api(`${url}?${params.toString()}`);
      const loadedMessages = (data.messages || []).map((m: any) => ({
        ...m,
        createdAt: m.createdAt ? (typeof m.createdAt === 'string' ? new Date(m.createdAt).getTime() : (typeof m.createdAt === 'number' ? m.createdAt : Date.now())) : Date.now(),
        expiresAt: m.expiresAt ? (typeof m.expiresAt === 'string' ? new Date(m.expiresAt).getTime() : (typeof m.expiresAt === 'number' ? m.expiresAt : undefined)) : undefined,
        isRead: m.isRead !== undefined ? m.isRead : false,
        readReceipts: (m.readReceipts || []).map((r: any) => ({
          userId: r.userId,
          readAt: typeof r.readAt === 'string' ? new Date(r.readAt).getTime() : (r.readAt ?? 0),
          user: r.user,
        })),
      }));
      
      if (append && loadedMessages.length > 0) {
        // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÑÑ‚Ð°Ñ€Ñ‹Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ Ð² Ð½Ð°Ñ‡Ð°Ð»Ð¾, ÑƒÐ´Ð°Ð»ÑÑ Ð´ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ‚Ñ‹
        setMessages(prev => {
          const combined = [...loadedMessages, ...prev];
          // Ð£Ð´Ð°Ð»ÑÐµÐ¼ Ð´ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ‚Ñ‹ Ð¿Ð¾ ID
          const uniqueMessages = combined.filter((message, index, self) =>
            index === self.findIndex((m) => m.id === message.id)
          );
          return uniqueMessages;
        });
        
        // Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ Ð¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽ Ð¿Ñ€Ð¾ÐºÑ€ÑƒÑ‚ÐºÐ¸
        const container = messagesContainerRef.current;
        if (container) {
          const scrollHeight = container.scrollHeight;
          setTimeout(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - scrollHeight;
            }
          }, 0);
        }
      } else {
        // Ð—Ð°Ð¼ÐµÐ½ÑÐµÐ¼ Ð²ÑÐµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ (Ð¿ÐµÑ€Ð²Ð°Ñ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ°), ÑƒÐ´Ð°Ð»ÑÑ Ð²Ð¾Ð·Ð¼Ð¾Ð¶Ð½Ñ‹Ðµ Ð´ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ‚Ñ‹
        const uniqueMessages = loadedMessages.filter((message, index, self) =>
          index === self.findIndex((m) => m.id === message.id)
        );
        setMessages(uniqueMessages);
        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
          }
        });
      }
      
      // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ ÑÐ¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ Ð¿Ð°Ð³Ð¸Ð½Ð°Ñ†Ð¸Ð¸
      if (loadedMessages.length < 50) {
        setHasMoreMessages(false);
      } else {
        setHasMoreMessages(true);
        if (loadedMessages.length > 0) {
          setOldestMessageId(loadedMessages[0].id);
        }
      }
      
      if (data.reactions) {
        const reactionsMap = new Map();
        data.reactions.forEach((r: any) => {
          if (!reactionsMap.has(r.messageId)) reactionsMap.set(r.messageId, []);
          reactionsMap.get(r.messageId).push({ userId: r.userId, emoji: r.emoji });
        });
        setReactions(reactionsMap);
      }
      
    } catch (e) {
      console.error('Failed to load messages:', e);
      setHasMoreMessages(false);
    }
  }, [chatId, selectedThreadId, groupKey]);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° ÑÑ‚Ð°Ñ€Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹
  const loadMoreMessages = useCallback(async () => {
    if (loadingMoreMessages || !hasMoreMessages || !oldestMessageId) return;
    
    setLoadingMoreMessages(true);
    try {
      await loadMessages(oldestMessageId, true);
    } finally {
      setLoadingMoreMessages(false);
    }
  }, [loadMessages, loadingMoreMessages, hasMoreMessages, oldestMessageId]);

  // ÐŸÐ¾Ð´Ñ‚ÑÐ³Ð¸Ð²Ð°Ð½Ð¸Ðµ Ð½Ð¾Ð²Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð¿Ð¾ Ñ‚Ð°Ð¹Ð¼ÐµÑ€Ñƒ (fallback, ÐµÑÐ»Ð¸ WebSocket Ð½Ðµ Ð´Ð¾ÑÑ‚Ð°Ð²Ð¸Ð»)
  const pollNewMessages = useCallback(async () => {
    if (!chatId || selectedThreadId) return;
    const url = `/api/chats/${chatId}/messages`;
    try {
      const data = await api(`${url}?limit=50`);
      const loaded = (data.messages || []).map((m: any) => ({
        ...m,
        createdAt: m.createdAt ? (typeof m.createdAt === 'string' ? new Date(m.createdAt).getTime() : (typeof m.createdAt === 'number' ? m.createdAt : Date.now())) : Date.now(),
        expiresAt: m.expiresAt ? (typeof m.expiresAt === 'string' ? new Date(m.expiresAt).getTime() : (typeof m.expiresAt === 'number' ? m.expiresAt : undefined)) : undefined,
        isRead: m.isRead !== undefined ? m.isRead : false,
        readReceipts: (m.readReceipts || []).map((r: any) => ({ userId: r.userId, readAt: typeof r.readAt === 'string' ? new Date(r.readAt).getTime() : (r.readAt ?? 0), user: r.user })),
      }));
      setMessages(prev => {
        const prevIds = new Set(prev.map(m => m.id));
        const newOnes = loaded.filter((m: Message) => !prevIds.has(m.id));
        if (newOnes.length === 0) return prev;
        const combined = [...prev, ...newOnes].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        return combined.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
      });
    } catch (_) { /* ignore */ }
  }, [chatId, selectedThreadId]);

  // ÐžÐ±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ° Ð¿Ñ€Ð¾ÐºÑ€ÑƒÑ‚ÐºÐ¸ Ð´Ð»Ñ Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð¸Ñ‡ÐµÑÐºÐ¾Ð¹ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop < 100 && hasMoreMessages && !loadingMoreMessages) {
      loadMoreMessages();
    }
    const nearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollToBottom((prev) => (prev !== !nearBottom ? !nearBottom : prev));
  }, [hasMoreMessages, loadingMoreMessages, loadMoreMessages]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    }
    setShowScrollToBottom(false);
  }, []);

  // ÐžÑ‚Ð¼ÐµÑ‚Ð¸Ñ‚ÑŒ Ñ‡Ð°Ñ‚ ÐºÐ°Ðº Ð¿Ñ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð½Ð½Ñ‹Ð¹
  const markChatAsRead = useCallback(async () => {
    if (!chatId) return;
    try {
      await api(`/api/chats/${chatId}/read`, 'POST');
    } catch (e) {
      // Ð˜Ð³Ð½Ð¾Ñ€Ð¸Ñ€ÑƒÐµÐ¼ Ð¾ÑˆÐ¸Ð±ÐºÐ¸, ÑÑ‚Ð¾ Ð½Ðµ ÐºÑ€Ð¸Ñ‚Ð¸Ñ‡Ð½Ð¾
    }
  }, [chatId]);
  
  // ÐžÑ‚Ð¼ÐµÑ‡Ð°ÐµÐ¼ Ñ‡Ð°Ñ‚ ÐºÐ°Ðº Ð¿Ñ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð½Ð½Ñ‹Ð¹ Ð¿Ð¾ÑÐ»Ðµ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹
  useEffect(() => {
    if (messages.length > 0 && chatId) {
      markChatAsRead();
      // Ð’Ñ‹Ð·Ñ‹Ð²Ð°ÐµÐ¼ callback Ð´Ð»Ñ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ ÑÑ‡ÐµÑ‚Ñ‡Ð¸ÐºÐ° Ð² Ñ€Ð¾Ð´Ð¸Ñ‚ÐµÐ»ÑŒÑÐºÐ¾Ð¼ ÐºÐ¾Ð¼Ð¿Ð¾Ð½ÐµÐ½Ñ‚Ðµ
      if (onMarkAsRead) {
        onMarkAsRead();
      }
    }
  }, [messages.length, chatId, markChatAsRead, onMarkAsRead]);

  // Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ Ð¼ÐµÐ½ÑŽ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ð¹ Ð¿Ð¾ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑŽ Ð¿Ñ€Ð¸ ÐºÐ»Ð¸ÐºÐµ Ð²Ð½Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
  useEffect(() => {
    if (!messageIdWithActions) return;
    const close = () => setMessageIdWithActions(null);
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [messageIdWithActions]);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð½Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹
  const loadPinnedMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const data = await api(`/api/chats/${chatId}/pinned`);
      const pinned = (data.pinned || []).map((p: any) => {
        const msg = p.message || {};
        return {
          ...msg,
          createdAt: msg.createdAt ? (typeof msg.createdAt === 'string' ? new Date(msg.createdAt).getTime() : (typeof msg.createdAt === 'number' ? msg.createdAt : Date.now())) : Date.now(),
          pinnedAt: p.pinnedAt ? (typeof p.pinnedAt === 'string' ? new Date(p.pinnedAt).getTime() : (typeof p.pinnedAt === 'number' ? p.pinnedAt : Date.now())) : Date.now(),
        };
      });
      setPinnedMessages(pinned);
    } catch (e) {
      console.error('Failed to load pinned messages:', e);
    }
  }, [chatId]);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð½Ð°Ð±Ð¾Ñ€Ð¾Ð² ÑÑ‚Ð¸ÐºÐµÑ€Ð¾Ð²
  const loadStickerPacks = useCallback(async () => {
    try {
      const data = await api('/api/sticker-packs');
      const packs = data.packs || [];
      setStickerPacks(packs);
      
      // Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ ÑÑ‚Ð¸ÐºÐµÑ€Ñ‹ Ð¸Ð· Ð²ÑÐµÑ… Ð½Ð°Ð±Ð¾Ñ€Ð¾Ð² Ð´Ð»Ñ Ð±Ñ‹ÑÑ‚Ñ€Ð¾Ð³Ð¾ Ð´Ð¾ÑÑ‚ÑƒÐ¿Ð°
      const allStickers = new Map<string, Sticker>();
      for (const pack of packs) {
        try {
          const stickersData = await api(`/api/sticker-packs/${pack.id}/stickers`);
          const packStickers = stickersData.stickers || [];
          packStickers.forEach((sticker: any) => {
            allStickers.set(sticker.id, {
              id: sticker.id,
              packId: pack.id,
              emoji: sticker.emoji || '',
              url: sticker.url,
              width: sticker.width || 128,
              height: sticker.height || 128
            });
          });
        } catch (e) {
          console.warn(`Failed to load stickers for pack ${pack.id}:`, e);
        }
      }
      setStickers(allStickers);
    } catch (e) {
      console.error('Failed to load sticker packs:', e);
    }
  }, []);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ñ‚Ñ€ÐµÐ´Ð¾Ð²
  const loadThreads = useCallback(async () => {
    try {
      const data = await api(`/api/chats/${chatId}/threads`);
      // ÐŸÑ€ÐµÐ¾Ð±Ñ€Ð°Ð·ÑƒÐµÐ¼ Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚ Ð´Ð°Ð½Ð½Ñ‹Ñ… Ñ‚Ñ€ÐµÐ´Ð¾Ð²
      const formattedThreads: Thread[] = (data.threads || []).map((t: any) => ({
        id: t.id,
        chatId: t.chatId || t.chat_id,
        rootMessageId: t.rootMessageId || t.root_message_id,
        name: t.name || '',
        createdAt: t.createdAt ? (typeof t.createdAt === 'string' ? new Date(t.createdAt).getTime() : (typeof t.createdAt === 'number' ? t.createdAt : Date.now())) : Date.now(),
        messageCount: t.messageCount || t.message_count || 0,
        lastMessage: t.lastMessage ? {
          id: t.lastMessage.id,
          text: t.lastMessage.text || '',
          createdAt: t.lastMessage.createdAt ? (typeof t.lastMessage.createdAt === 'string' ? new Date(t.lastMessage.createdAt).getTime() : (typeof t.lastMessage.createdAt === 'number' ? t.lastMessage.createdAt : Date.now())) : Date.now(),
        } : undefined,
        unreadCount: t.unreadCount || t.unread_count || 0,
      }));
      setThreads(formattedThreads);
    } catch (e) {
      console.error('Failed to load threads:', e);
    }
  }, [chatId]);

  // ÐŸÑ€Ð¸Ð¼ÐµÐ½ÐµÐ½Ð¸Ðµ Ñ„Ð¾Ð½Ð° Ð¸ Ñ†Ð²ÐµÑ‚Ð° Ñ‡Ð°Ñ‚Ð°
  useEffect(() => {
    if (!chatId) return;
    
    const chatBg = getChatBackground(chatId);
    const chatColor = getChatColor(chatId);
    
    // Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ ref Ð´Ð»Ñ ÐºÐ¾Ð½Ñ‚ÐµÐ¹Ð½ÐµÑ€Ð° Ñ‡Ð°Ñ‚Ð°
    const chatWindowElement = document.querySelector('.enhanced-chat-window') as HTMLElement;
    if (chatWindowElement) {
      if (chatBg) {
        chatWindowElement.style.backgroundImage = `url(${chatBg})`;
        chatWindowElement.style.backgroundSize = 'cover';
        chatWindowElement.style.backgroundPosition = 'center';
        chatWindowElement.style.backgroundRepeat = 'no-repeat';
        chatWindowElement.style.backgroundAttachment = 'fixed';
      } else {
        chatWindowElement.style.backgroundImage = '';
        chatWindowElement.style.backgroundAttachment = '';
      }
      
      if (chatColor) {
        chatWindowElement.style.setProperty('--accent-primary', chatColor);
        chatWindowElement.style.setProperty('--accent', chatColor);
      } else {
        chatWindowElement.style.removeProperty('--accent-primary');
        chatWindowElement.style.removeProperty('--accent');
      }
    }
    
    return () => {
      if (chatWindowElement) {
        chatWindowElement.style.backgroundImage = '';
        chatWindowElement.style.backgroundAttachment = '';
        chatWindowElement.style.removeProperty('--accent-primary');
        chatWindowElement.style.removeProperty('--accent');
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    
    loadUsers();
    loadChatInfo().then(() => {
      // Ð˜Ð½Ð¸Ñ†Ð¸Ð°Ð»Ð¸Ð·Ð¸Ñ€ÑƒÐµÐ¼ E2EE Ð´Ð»Ñ Ð³Ñ€ÑƒÐ¿Ð¿ Ð¿Ð¾ÑÐ»Ðµ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸ Ð¸Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸Ð¸ Ð¾ Ñ‡Ð°Ñ‚Ðµ
      if (chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') {
        initializeGroupE2EE();
      }
    });
    loadMessages();
    loadPinnedMessages();
    loadStickerPacks();
    loadNotificationSettings();
    if (chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') {
      loadThreads();
    }
    
    const socket = getSocket();
    socketRef.current = socket;

    const doSubscribe = () => {
      const s = getSocket();
      if (s && s.readyState === WebSocket.OPEN) {
        sendOptimized('subscribe', { chatId }, true);
      }
    };

    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        doSubscribe();
      } else {
        const onOpen = () => {
          doSubscribe();
          socket.removeEventListener('open', onOpen);
        };
        socket.addEventListener('open', onOpen);
      }

      const handleMessage = (event: MessageEvent) => {
        try {
          // Ð‘ÑÐºÐµÐ½Ð´ Ð¼Ð¾Ð¶ÐµÑ‚ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÑ‚ÑŒ Ð½ÐµÑÐºÐ¾Ð»ÑŒÐºÐ¾ JSON Ñ‡ÐµÑ€ÐµÐ· \n
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
          
          // Ð‘ÑÐºÐµÐ½Ð´ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÑ‚ {"type": "message", "data": {...}}
          const messageData = data.data || data;
          const msgType = data.type;
          
          if (msgType === 'message') {
            const msgChatId = messageData.chatId || messageData.chat_id || data.chatId;
            if (msgChatId !== chatId) return;
            
            const msg: Message = {
              id: messageData.id,
              chatId: msgChatId,
              senderId: messageData.senderId || messageData.sender_id,
              text: messageData.text || '',
              ciphertext: messageData.ciphertext,
              attachmentUrl: messageData.attachmentUrl || messageData.attachment_url,
              attachmentDuration: messageData.attachmentDuration ?? messageData.attachment_duration,
              replyTo: messageData.replyTo || messageData.reply_to,
              replyToMessage: messageData.replyToMessage || messageData.reply_to_message,
              forwardFrom: messageData.forwardFrom || messageData.forward_from,
              forwardFromChatId: messageData.forwardFromChatId || messageData.forward_from_chat_id,
              forwardedMessage: messageData.forwardedMessage || messageData.forwarded_message,
              threadId: messageData.threadId || messageData.thread_id,
              stickerId: messageData.stickerId || messageData.sticker_id,
              editedAt: messageData.editedAt ? (typeof messageData.editedAt === 'string' ? new Date(messageData.editedAt).getTime() : messageData.editedAt) : undefined,
              deletedAt: messageData.deletedAt ? (typeof messageData.deletedAt === 'string' ? new Date(messageData.deletedAt).getTime() : messageData.deletedAt) : undefined,
              expiresAt: messageData.expiresAt ? (typeof messageData.expiresAt === 'string' ? new Date(messageData.expiresAt).getTime() : messageData.expiresAt) : undefined,
              createdAt: messageData.createdAt ? (typeof messageData.createdAt === 'string' ? new Date(messageData.createdAt).getTime() : (typeof messageData.createdAt === 'number' ? messageData.createdAt : Date.now())) : Date.now(),
            };
            
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              const newMessages = [...prev, msg];
              const uniqueMessages = newMessages.filter((message, index, self) =>
                index === self.findIndex((m) => m.id === message.id)
              );
              return uniqueMessages;
            });

            setTimeout(() => {
              const el = document.querySelector(`[data-message-id="${msg.id}"]`);
              if (el) el.classList.add('received');
            }, 0);

            if (msg.senderId !== currentUser?.id) {
              if (ui.notificationsEnabled && notificationSettings.desktopEnabled && (!isPageVisible || document.hidden)) {
                const sender = users.get(msg.senderId);
                const senderName = sender?.username || 'ÐÐµÐ¸Ð·Ð²ÐµÑÑ‚Ð½Ñ‹Ð¹';
                const chatName = chatInfoRef.current?.name || (chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel' ? chatInfoRef.current.type : undefined);
                const chatType = chatInfoRef.current?.type as 'dm' | 'group' | 'channel' | undefined;
                const isMention = currentUser && msg.text?.includes(`@${currentUser.username}`);
                let soundType = notificationSettings.soundType;
                let volume = notificationSettings.soundVolume / 100;
                if (isMention && notificationSettings.soundMention) {
                  soundType = notificationSettings.soundMention as any;
                  volume = (notificationSettings.volumeMention || notificationSettings.soundVolume) / 100;
                } else if (chatType === 'group' && notificationSettings.soundGroup) {
                  soundType = notificationSettings.soundGroup as any;
                  volume = (notificationSettings.volumeGroup || notificationSettings.soundVolume) / 100;
                } else if (chatType === 'channel' && notificationSettings.soundChannel) {
                  soundType = notificationSettings.soundChannel as any;
                  volume = (notificationSettings.volumeChannel || notificationSettings.soundVolume) / 100;
                } else if (notificationSettings.soundMessage) {
                  soundType = notificationSettings.soundMessage as any;
                  volume = (notificationSettings.volumeMessage || notificationSettings.soundVolume) / 100;
                }
                notifyNewMessage(
                  senderName,
                  msg.text || (msg.attachmentUrl ? 'ðŸ“Ž Ð’Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ' : 'Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ'),
                  chatName,
                  chatId,
                  sender?.avatarUrl,
                  notificationSettings.soundEnabled,
                  volume,
                  soundType,
                  msg.attachmentUrl,
                  isMention,
                  chatType,
                  notificationSettings.dndStart,
                  notificationSettings.dndEnd
                ).catch(err => console.warn('Failed to show notification:', err));
              } else if (notificationSettings.soundEnabled) {
                playMessageSound();
              }
            }

            requestAnimationFrame(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            });
          } else if (msgType === 'message:update' || msgType === 'message_update') {
            const updateData = data.data || data;
            const msgChatId = updateData.chatId || updateData.chat_id || data.chatId;
            if (msgChatId !== chatId) return;
            
            const msg: Message = {
              id: updateData.id || data.id,
              chatId: msgChatId,
              senderId: updateData.senderId || updateData.sender_id || data.senderId,
              text: updateData.text || data.text || '',
              attachmentUrl: updateData.attachmentUrl || updateData.attachment_url || data.attachmentUrl,
              editedAt: updateData.editedAt ? new Date(updateData.editedAt).getTime() : undefined,
              createdAt: updateData.createdAt ? new Date(updateData.createdAt).getTime() : Date.now(),
            };
            setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
          } else if (msgType === 'message:delete' || msgType === 'message_delete') {
            const deleteData = data.data || data;
            const msgChatId = deleteData.chatId || deleteData.chat_id || data.chatId;
            if (msgChatId !== chatId) return;
            
            if (deleteData.deleteForAll || data.deleteForAll) {
              setMessages(prev => prev.map(m => m.id === (deleteData.messageId || data.messageId) ? { ...m, deletedAt: Date.now(), text: '', attachmentUrl: undefined } : m));
            } else {
              setMessages(prev => prev.filter(m => m.id !== (deleteData.messageId || data.messageId)));
            }
          } else if (msgType === 'reaction') {
            const reactionData = data.data || data;
            const msgChatId = reactionData.chatId || reactionData.chat_id || data.chatId;
            if (msgChatId !== chatId) return;
            
            setReactions(prev => {
              const newMap = new Map(prev);
              const messageId = reactionData.messageId || reactionData.message_id || data.messageId;
              if (!newMap.has(messageId)) newMap.set(messageId, []);
              const reactions = newMap.get(messageId)! as Array<{userId: string, emoji: string}>;
              const userId = reactionData.userId || reactionData.user_id || data.userId;
              const emoji = reactionData.emoji || data.emoji;
              const existing = reactions.find(r => r.userId === userId && r.emoji === emoji);
              if (!existing) reactions.push({ userId, emoji });
              return newMap;
            });
          } else if (msgType === 'typing') {
            const typingData = data.data || data;
            const msgChatId = typingData.chatId || typingData.chat_id || data.chatId;
            if (msgChatId !== chatId) return;
            
            const userId = typingData.userId || typingData.user_id || data.userId;
            const isTyping = typingData.isTyping !== undefined ? typingData.isTyping : data.isTyping;
            
            if (isTyping) {
              setTypingUsers(prev => new Set(prev).add(userId));
            } else {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
              });
            }
          } else if (msgType === 'webrtc:offer') {
            // Ð’Ñ…Ð¾Ð´ÑÑ‰Ð¸Ð¹ Ð·Ð²Ð¾Ð½Ð¾Ðº
            const offerData = data.data || data;
            const fromUserId = offerData.from || data.from;
            const msgChatId = offerData.chatId || data.chatId;
            
            if (msgChatId === chatId && fromUserId && chatInfoRef.current?.type === 'dm' && !inDMCall) {
              const isVideo = offerData.video !== false; // ÐŸÐ¾ ÑƒÐ¼Ð¾Ð»Ñ‡Ð°Ð½Ð¸ÑŽ Ð²Ð¸Ð´ÐµÐ¾, ÐµÑÐ»Ð¸ Ð½Ðµ ÑƒÐºÐ°Ð·Ð°Ð½Ð¾
              
              // ÐŸÐ¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ Ð¾ Ð·Ð²Ð¾Ð½ÐºÐµ
              if (ui.notificationsEnabled && notificationSettings.desktopEnabled) {
                const caller = users.get(fromUserId);
                const callerName = caller?.username || 'ÐÐµÐ¸Ð·Ð²ÐµÑÑ‚Ð½Ñ‹Ð¹';
                
                const callSoundType = (notificationSettings.soundCall || 'alert') as any;
                const callVolume = (notificationSettings.volumeCall || notificationSettings.soundVolume) / 100;
                notifyCall(
                  callerName,
                  isVideo,
                  chatId,
                  caller?.avatarUrl,
                  notificationSettings.soundEnabled,
                  callVolume,
                  callSoundType
                ).catch(err => console.warn('Failed to show call notification:', err));
              } else if (notificationSettings.soundEnabled) {
                playCallSound();
              }
              // Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ Ð²Ñ€ÐµÐ¼Ñ Ð½Ð°Ñ‡Ð°Ð»Ð° Ð²Ñ…Ð¾Ð´ÑÑ‰ÐµÐ³Ð¾ Ð·Ð²Ð¾Ð½ÐºÐ° Ð´Ð»Ñ Ð²Ð¾Ð·Ð¼Ð¾Ð¶Ð½Ð¾Ð³Ð¾ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ñ ÐºÐ°Ðº Ð¿Ñ€Ð¾Ð¿ÑƒÑ‰ÐµÐ½Ð½Ð¾Ð³Ð¾
              const incomingCallStartTime = Date.now();
              const callKey = `${chatId}-${fromUserId}`;
              
              // ÐžÑ‡Ð¸Ñ‰Ð°ÐµÐ¼ Ð¿Ñ€ÐµÐ´Ñ‹Ð´ÑƒÑ‰Ð¸Ð¹ Ñ‚Ð°Ð¹Ð¼ÐµÑ€ ÐµÑÐ»Ð¸ ÐµÑÑ‚ÑŒ
              const existingTimer = incomingCallTimerRef.current.get(callKey);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }
              
              const confirmed = window.confirm(`Ð’Ñ…Ð¾Ð´ÑÑ‰Ð¸Ð¹ ${isVideo ? 'Ð²Ð¸Ð´ÐµÐ¾' : ''}Ð·Ð²Ð¾Ð½Ð¾Ðº Ð¾Ñ‚ ${users.get(fromUserId)?.username || 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ'}. ÐŸÑ€Ð¸Ð½ÑÑ‚ÑŒ?`);
              if (confirmed) {
                setInDMCall({ 
                  isVideo, 
                  otherUserId: fromUserId,
                  isIncoming: true,
                  offerData: offerData
                });
                // ÐžÑ‡Ð¸Ñ‰Ð°ÐµÐ¼ Ñ‚Ð°Ð¹Ð¼ÐµÑ€, Ñ‚Ð°Ðº ÐºÐ°Ðº Ð·Ð²Ð¾Ð½Ð¾Ðº Ð¿Ñ€Ð¸Ð½ÑÑ‚
                incomingCallTimerRef.current.delete(callKey);
              } else {
                // ÐžÑ‚ÐºÐ»Ð¾Ð½ÑÐµÐ¼ Ð·Ð²Ð¾Ð½Ð¾Ðº Ð¸ ÑÐ¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ ÐºÐ°Ðº Ð¿Ñ€Ð¾Ð¿ÑƒÑ‰ÐµÐ½Ð½Ñ‹Ð¹
                sendOptimized('webrtc:hangup', {
                  chatId,
                  to: fromUserId,
                });
                // Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ ÐºÐ°Ðº Ð¿Ñ€Ð¾Ð¿ÑƒÑ‰ÐµÐ½Ð½Ñ‹Ð¹
                api('/api/calls', 'POST', {
                  chatId,
                  otherUserId: fromUserId,
                  type: isVideo ? 'video' : 'voice',
                  status: 'missed',
                  duration: 0,
                  startedAt: incomingCallStartTime,
                  endedAt: Date.now(),
                }).catch(e => console.error('Failed to save missed call:', e));
                incomingCallTimerRef.current.delete(callKey);
              }
              
              // Ð•ÑÐ»Ð¸ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ Ð½Ðµ Ð¾Ñ‚Ð²ÐµÑ‚Ð¸Ñ‚ Ð² Ñ‚ÐµÑ‡ÐµÐ½Ð¸Ðµ 30 ÑÐµÐºÑƒÐ½Ð´, ÑÐ¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ ÐºÐ°Ðº Ð¿Ñ€Ð¾Ð¿ÑƒÑ‰ÐµÐ½Ð½Ñ‹Ð¹
              const timer = setTimeout(() => {
                // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, Ñ‡Ñ‚Ð¾ Ð·Ð²Ð¾Ð½Ð¾Ðº Ð²ÑÐµ ÐµÑ‰Ðµ Ð²Ñ…Ð¾Ð´ÑÑ‰Ð¸Ð¹ Ð¸ Ð½Ðµ Ð±Ñ‹Ð» Ð¿Ñ€Ð¸Ð½ÑÑ‚
                if (!inDMCall || inDMCall.otherUserId !== fromUserId || !inDMCall.isIncoming) {
                  // Ð—Ð²Ð¾Ð½Ð¾Ðº Ð½Ðµ Ð±Ñ‹Ð» Ð¿Ñ€Ð¸Ð½ÑÑ‚ - ÑÐ¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ ÐºÐ°Ðº Ð¿Ñ€Ð¾Ð¿ÑƒÑ‰ÐµÐ½Ð½Ñ‹Ð¹
                  api('/api/calls', 'POST', {
                    chatId,
                    otherUserId: fromUserId,
                    type: isVideo ? 'video' : 'voice',
                    status: 'missed',
                    duration: 0,
                    startedAt: incomingCallStartTime,
                    endedAt: Date.now(),
                  }).catch(e => console.error('Failed to save missed call:', e));
                }
                incomingCallTimerRef.current.delete(callKey);
              }, 30000);
              incomingCallTimerRef.current.set(callKey, timer);
            }
          } else if (msgType === 'webrtc:hangup') {
            // Ð—Ð²Ð¾Ð½Ð¾Ðº Ð·Ð°Ð²ÐµÑ€ÑˆÐµÐ½
            const hangupData = data.data || data;
            const fromUserId = hangupData.from || data.from;
            if (fromUserId && inDMCall && inDMCall.otherUserId === fromUserId) {
              setInDMCall(null);
              showToast('Ð—Ð²Ð¾Ð½Ð¾Ðº Ð·Ð°Ð²ÐµÑ€ÑˆÐµÐ½', 'info');
            }
              } else if (msgType === 'message:pinned') {
                // Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð¾
                const pinData = data.data || data;
                const msgChatId = pinData.chatId || data.chatId;
                if (msgChatId !== chatId) return;
                
                // ÐŸÐµÑ€ÐµÐ·Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð½Ñ‹Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
                loadPinnedMessages();
                showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð¾', 'info');
              } else if (msgType === 'message:unpinned') {
                // Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¾Ñ‚ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð¾
                const unpinData = data.data || data;
                const msgChatId = unpinData.chatId || data.chatId;
                if (msgChatId !== chatId) return;
                
                // ÐŸÐµÑ€ÐµÐ·Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð½Ñ‹Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
                loadPinnedMessages();
                showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¾Ñ‚ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð¾', 'info');
              } else if (msgType === 'presence') {
                const presenceData = data.data || data;
                const userId = presenceData.userId;
                const status = presenceData.status;
                const onlineList = presenceData.online || [] as string[];
                setUsers(prev => {
                  const newMap = new Map(prev);
                  if (userId && status) {
                    const user = newMap.get(userId);
                    if (user) {
                      newMap.set(userId, { ...user, status: status === 'online' ? 'online' : 'offline' });
                    }
                  }
                  if (Array.isArray(onlineList) && onlineList.length > 0) {
                    onlineList.forEach((id: string) => {
                      const u = newMap.get(id);
                      if (u) newMap.set(id, { ...u, status: 'online' });
                    });
                  }
                  return newMap;
                });
              } else if (msgType === 'message:read' || msgType === 'chat:read') {
                // ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ ÑÑ‚Ð°Ñ‚ÑƒÑÐ° Ð¿Ñ€Ð¾Ñ‡Ñ‚ÐµÐ½Ð¸Ñ
                const readData = data.data || data;
                const msgChatId = readData.chatId || data.chatId;
                if (msgChatId !== chatId) return;
                
                const messageId = readData.messageId || data.messageId;
                const userId = readData.userId || data.userId;
                const readAt = readData.readAt ? (typeof readData.readAt === 'string' ? new Date(readData.readAt).getTime() : readData.readAt) : Date.now();
                
                if (messageId) {
                  // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ ÐºÐ¾Ð½ÐºÑ€ÐµÑ‚Ð½Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ
                  setMessages(prev => prev.map(m => {
                    if (m.id === messageId && m.senderId === currentUser.id) {
                      const receipts = m.readReceipts || [];
                      if (!receipts.find(r => r.userId === userId)) {
                        return {
                          ...m,
                          readReceipts: [...receipts, { userId, readAt }],
                        };
                      }
                    }
                    return m;
                  }));
                } else {
                  // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ Ð²ÑÐµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ Ð¾Ñ‚ Ñ‚ÐµÐºÑƒÑ‰ÐµÐ³Ð¾ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð² Ñ‡Ð°Ñ‚Ðµ
                  setMessages(prev => prev.map(m => {
                    if (m.senderId === currentUser.id && m.chatId === msgChatId) {
                      const receipts = m.readReceipts || [];
                      if (!receipts.find(r => r.userId === userId)) {
                        return {
                          ...m,
                          readReceipts: [...receipts, { userId, readAt }],
                        };
                      }
                    }
                    return m;
                  }));
                }
              }
      };

      socket.addEventListener('message', handleMessage);

      // ÐŸÑ€Ð¾Ð²ÐµÑ€ÐºÐ° Ð¸ÑÑ‚ÐµÐºÑˆÐ¸Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ ÐºÐ°Ð¶Ð´ÑƒÑŽ Ð¼Ð¸Ð½ÑƒÑ‚Ñƒ
      const expireCheckInterval = setInterval(() => {
        setMessages(prev => {
          const now = Date.now();
          return prev.filter(m => !m.expiresAt || m.expiresAt > now);
        });
      }, 60000);

      return () => {
        socket.removeEventListener('message', handleMessage);
        if (socket.readyState === WebSocket.OPEN) {
          sendOptimized('unsubscribe', { chatId }, true);
        }
        clearInterval(expireCheckInterval);
      };
    }

    return () => {
      const s = getSocket();
      if (s && s.readyState === WebSocket.OPEN) {
        sendOptimized('unsubscribe', { chatId }, true);
      }
    };
  }, [chatId, currentUser.id, loadMessages, loadUsers]);

  useEffect(() => {
    if (!chatId || !isE2EEEnabled) return;
    const chatType = chatInfoRef.current?.type;
    if (chatType === 'group' || chatType === 'channel') return;
    const key = `safegram_e2ee_notice_${chatId}`;
    if (!shouldShowOnceToast(key)) return;
    showToast('E2EE инициализировано', 'info');
  }, [chatId, isE2EEEnabled, shouldShowOnceToast]);

  // ÐžÐ¿Ñ€Ð¾Ñ Ð½Ð¾Ð²Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ ÐºÐ°Ð¶Ð´Ñ‹Ðµ 4 Ñ (fallback, ÐµÑÐ»Ð¸ WebSocket Ð½Ðµ Ð´Ð¾ÑÑ‚Ð°Ð²Ð¸Ð»)
  useEffect(() => {
    if (!chatId || selectedThreadId) return;
    const t = setInterval(pollNewMessages, 12000);
    return () => clearInterval(t);
  }, [chatId, selectedThreadId, pollNewMessages]);

  // ÐÐ²Ñ‚Ð¾ÑÐºÑ€Ð¾Ð»Ð» Ð¿Ñ€Ð¸ Ð½Ð¾Ð²Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑÑ… (Ð¼Ð³Ð½Ð¾Ð²ÐµÐ½Ð½Ð¾)
  useEffect(() => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      setShowScrollToBottom(false);
    });
  }, [messages]);

  // ÐÐ²Ñ‚Ð¾ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ðµ Ñ‡ÐµÑ€Ð½Ð¾Ð²Ð¸ÐºÐ¾Ð²
  useEffect(() => {
    if (text.trim() && chatId) {
      const draftKey = `draft_${chatId}`;
      localStorage.setItem(draftKey, text);
    }
  }, [text, chatId]);

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ñ‡ÐµÑ€Ð½Ð¾Ð²Ð¸ÐºÐ° Ð¿Ñ€Ð¸ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚Ð¸Ð¸ Ñ‡Ð°Ñ‚Ð°
  useEffect(() => {
    if (chatId) {
      const draftKey = `draft_${chatId}`;
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        setText(draft);
      }
    }
  }, [chatId]);

  // ÐžÑ‚Ð¼ÐµÐ½Ð° Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
  const undoSendMessage = async () => {
    if (!lastSentMessage || !canUndo) return;
    
    const timeSinceSend = Date.now() - lastSentMessage.timestamp;
    if (timeSinceSend > 5000) {
      setCanUndo(false);
      return;
    }
    
    try {
      await api(`/api/messages/${lastSentMessage.id}/delete`, 'POST', { deleteForAll: true });
      setMessages(prev => prev.filter(m => m.id !== lastSentMessage.id));
      setLastSentMessage(null);
      setCanUndo(false);
      showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¾Ñ‚Ð¼ÐµÐ½ÐµÐ½Ð¾', 'success');
    } catch (e: any) {
      showToast('ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÑƒ', 'error');
    }
  };

  // ÐžÐ±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ° Ð¾Ñ„Ð»Ð°Ð¹Ð½ Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ Ð¿Ñ€Ð¸ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ð¸ ÑÐ²ÑÐ·Ð¸
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      if (online && chatId) {
        // Ð¡Ð¸Ð½Ñ…Ñ€Ð¾Ð½Ð¸Ð·Ð¸Ñ€ÑƒÐµÐ¼ Ð¾Ñ‡ÐµÑ€ÐµÐ´ÑŒ Ð¿Ñ€Ð¸ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ð¸ ÑÐ²ÑÐ·Ð¸
        processOfflineQueue(async (message) => {
          if (message.chatId === chatId) {
            try {
              await api(`/api/chats/${chatId}/messages`, 'POST', {
                text: message.text,
                attachmentUrl: message.attachmentUrl,
                replyToId: message.replyToId,
                type: message.type,
                ...message.data
              });
              // Ð£Ð´Ð°Ð»ÑÐµÐ¼ Ð¸Ð· Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ Ð¿Ð¾ÑÐ»Ðµ ÑƒÑÐ¿ÐµÑˆÐ½Ð¾Ð¹ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸
              removeFromOfflineQueue(message.id);
            } catch (e) {
              console.error('Failed to sync message:', e);
              // Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¾ÑÑ‚Ð°Ð½ÐµÑ‚ÑÑ Ð² Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ Ð´Ð»Ñ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð¾Ð¹ Ð¿Ð¾Ð¿Ñ‹Ñ‚ÐºÐ¸
            }
          }
        }).catch(e => console.error('Failed to sync offline queue:', e));
      }
    });

    return unsubscribe;
  }, [chatId]);

  // ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ° ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
  const sendMessage = async (messageText?: string, attachmentUrl?: string, stickerId?: string, expiresMs?: number, threadId?: string) => {
    // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, Ñ‡Ñ‚Ð¾ ÐµÑÑ‚ÑŒ Ñ…Ð¾Ñ‚Ñ Ð±Ñ‹ Ñ‚ÐµÐºÑÑ‚, Ð²Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ Ð¸Ð»Ð¸ ÑÑ‚Ð¸ÐºÐµÑ€
    const finalText = messageText !== undefined ? messageText : text.trim();
    if (!finalText && !attachmentUrl && !stickerId) return;
    if (finalText.length > MAX_MESSAGE_LENGTH) {
      showToast(`Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð½Ðµ Ð´Ð¾Ð»Ð¶Ð½Ð¾ Ð¿Ñ€ÐµÐ²Ñ‹ÑˆÐ°Ñ‚ÑŒ ${MAX_MESSAGE_LENGTH} ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð² (ÑÐµÐ¹Ñ‡Ð°Ñ ${finalText.length})`, 'error');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        text: finalText || null,
        attachmentUrl: attachmentUrl || null,
        replyTo: replyingTo?.id || null,
        stickerId: stickerId || null,
        expiresMs: expiresMs || null
      };

      const isGroupLike = chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel';
      let activeGroupKey = groupKey;

      // Ð“Ð°Ñ€Ð°Ð½Ñ‚Ð¸Ñ€ÑƒÐµÐ¼ Ð¸Ð½Ð¸Ñ†Ð¸Ð°Ð»Ð¸Ð·Ð°Ñ†Ð¸ÑŽ E2EE ÐºÐ»ÑŽÑ‡Ð° Ð´Ð¾ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸
      if (isE2EEEnabled && isGroupLike && finalText && !activeGroupKey) {
        activeGroupKey = await loadGroupKey();
      }

      // Ð¨Ð¸Ñ„Ñ€ÑƒÐµÐ¼ Ñ‚ÐµÐºÑÑ‚ Ð´Ð»Ñ Ð³Ñ€ÑƒÐ¿Ð¿ Ñ E2EE
      if (isE2EEEnabled && isGroupLike && finalText) {
        if (!activeGroupKey) {
          showToast('E2EE ÐºÐ»ÑŽÑ‡ ÐµÑ‰Ðµ Ð½Ðµ Ð³Ð¾Ñ‚Ð¾Ð². ÐŸÐ¾Ð¿Ñ€Ð¾Ð±ÑƒÐ¹Ñ‚Ðµ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ Ñ‡ÐµÑ€ÐµÐ· ÑÐµÐºÑƒÐ½Ð´Ñƒ.', 'warning');
          return;
        }
        try {
          const ciphertext = await encryptPlaintext(activeGroupKey, finalText);
          payload.ciphertext = ciphertext;
          payload.text = null; // ÐÐµ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚Ñ‹Ð¹ Ñ‚ÐµÐºÑÑ‚
        } catch (e) {
          console.error('Failed to encrypt message:', e);
          showToast('ÐžÑˆÐ¸Ð±ÐºÐ° ÑˆÐ¸Ñ„Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ', 'error');
          return;
        }
      }
      
      if (selectedThreadId || threadId) {
        payload.threadId = threadId || selectedThreadId;
      }

      // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð¾Ð½Ð»Ð°Ð¹Ð½ ÑÑ‚Ð°Ñ‚ÑƒÑ Ð´Ð¾ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ð¾Ð³Ð¾ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
      if (!isOnline()) {
        const queueId = addToOfflineQueue({
          chatId,
          text: messageText,
          attachmentUrl,
          replyToId: replyingTo?.id,
          type: attachmentUrl ? 'media' : 'text',
          data: payload
        });

        const queuedMessage: Message = {
          id: queueId,
          chatId,
          senderId: currentUser.id,
          text: messageText || '',
          attachmentUrl,
          replyTo: replyingTo?.id,
          replyToMessage: replyingTo,
          threadId,
          createdAt: Date.now(),
          sending: true
        };

        setMessages(prev => [...prev, queuedMessage]);
        showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð±ÑƒÐ´ÐµÑ‚ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¾ Ð¿Ñ€Ð¸ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ð¸ ÑÐ²ÑÐ·Ð¸', 'info');
        return;
      }

      // ÐžÐ¿Ñ‚Ð¸Ð¼Ð¸ÑÑ‚Ð¸Ñ‡Ð½Ð¾Ðµ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ - Ð´Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ ÑÑ€Ð°Ð·Ñƒ
      const tempId = 'temp-' + Date.now();
      const optimisticMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.id,
        text: finalText || '',
        attachmentUrl: attachmentUrl || undefined,
        replyTo: replyingTo?.id || undefined,
        stickerId: stickerId || undefined,
        createdAt: Date.now(),
        ...(expiresMs ? { expiresAt: Date.now() + expiresMs } : {}),
      };
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÐºÐ»Ð°ÑÑ Ð´Ð»Ñ Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸Ð¸ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${tempId}"]`);
        if (messageElement) {
          messageElement.classList.add('sending');
        }
      }, 0);
      
      try {
        flushWebSocketBatch();
        const response = await api(`/api/chats/${chatId}/messages`, 'POST', payload);
        const realId = response.id;
        // Ð—Ð°Ð¼ÐµÐ½ÑÐµÐ¼ Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð½Ð° Ñ€ÐµÐ°Ð»ÑŒÐ½Ð¾Ðµ
        setMessages(prev => prev.map(m => m.id === tempId ? {
          ...m,
          id: realId,
          createdAt: typeof response.createdAt === 'string' ? new Date(response.createdAt).getTime() : (typeof response.createdAt === 'number' ? response.createdAt : Date.now()),
          expiresAt: response.expiresAt ? (typeof response.expiresAt === 'string' ? new Date(response.expiresAt).getTime() : response.expiresAt) : m.expiresAt,
          uploadProgress: 100,
          sending: false,
        } : m));
        
        // Ð£Ð±Ð¸Ñ€Ð°ÐµÐ¼ ÐºÐ»Ð°ÑÑ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ Ð¸ Ð´Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÐºÐ»Ð°ÑÑ Ð¿Ð¾Ð»ÑƒÑ‡ÐµÐ½Ð¸Ñ
        setTimeout(() => {
          const messageElement = document.querySelector(`[data-message-id="${realId}"]`);
          if (messageElement) {
            messageElement.classList.remove('sending');
            messageElement.classList.add('received');
          }
        }, 0);
        
        // Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ Ð´Ð»Ñ Ð²Ð¾Ð·Ð¼Ð¾Ð¶Ð½Ð¾ÑÑ‚Ð¸ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‹
        setLastSentMessage({ id: realId, timestamp: Date.now() });
        setCanUndo(true);
        setTimeout(() => setCanUndo(false), 5000);
        
        // ÐžÑ‡Ð¸Ñ‰Ð°ÐµÐ¼ Ñ‡ÐµÑ€Ð½Ð¾Ð²Ð¸Ðº
        if (chatId) {
          localStorage.removeItem(`draft_${chatId}`);
        }
        setText('');
        setReplyingTo(null);
        setEditingMessage(null);
        sendOptimized('typing', { chatId, isTyping: false });
      } catch (e: any) {
        // Ð£Ð´Ð°Ð»ÑÐµÐ¼ Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¿Ñ€Ð¸ Ð¾ÑˆÐ¸Ð±ÐºÐµ
        setMessages(prev => prev.filter(m => m.id !== tempId));
        showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
        throw e;
      }
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Ð ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
  const editMessage = async (messageId: string, newText: string) => {
    if (!newText.trim()) {
      showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð½Ðµ Ð¼Ð¾Ð¶ÐµÑ‚ Ð±Ñ‹Ñ‚ÑŒ Ð¿ÑƒÑÑ‚Ñ‹Ð¼', 'warning');
      return;
    }
    if (newText.length > MAX_MESSAGE_LENGTH) {
      showToast(`Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð½Ðµ Ð´Ð¾Ð»Ð¶Ð½Ð¾ Ð¿Ñ€ÐµÐ²Ñ‹ÑˆÐ°Ñ‚ÑŒ ${MAX_MESSAGE_LENGTH} ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð²`, 'error');
      return;
    }
    try {
      await api(`/api/messages/${messageId}/edit`, 'POST', { text: newText.trim() });
      setEditingMessage(null);
      showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¾', 'success');
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¸Ð·Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
    }
  };

  // Ð£Ð´Ð°Ð»ÐµÐ½Ð¸Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
  const deleteMessage = async (messageId: string, deleteForAll: boolean = false) => {
    try {
      await api(`/api/messages/${messageId}/delete`, 'POST', { deleteForAll });
      showToast(deleteForAll ? 'Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ ÑƒÐ´Ð°Ð»ÐµÐ½Ð¾ Ð´Ð»Ñ Ð²ÑÐµÑ…' : 'Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ ÑƒÐ´Ð°Ð»ÐµÐ½Ð¾', 'success');
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
    }
  };

  // ÐŸÐ¾Ð¸ÑÐº Ð¿Ð¾ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑÐ¼
  const searchMessages = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const data = await api(`/api/messages/search?q=${encodeURIComponent(query)}&chatId=${chatId}`);
      const results = data.messages || [];
      
      // ÐŸÑ€ÐµÐ¾Ð±Ñ€Ð°Ð·ÑƒÐµÐ¼ Ñ€ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚Ñ‹ Ð² Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚ Message
      const formattedResults: Message[] = results.map((msg: any) => ({
        id: msg.id,
        chatId: msg.chatId || msg.chat_id || chatId,
        senderId: msg.senderId || msg.sender_id,
        text: msg.text || '',
        attachmentUrl: msg.attachmentUrl || msg.attachment_url,
        attachmentDuration: msg.attachmentDuration ?? msg.attachment_duration,
        replyTo: msg.replyTo || msg.reply_to,
        replyToMessage: msg.replyToMessage,
        forwardFrom: msg.forwardFrom || msg.forward_from,
        threadId: msg.threadId || msg.thread_id,
        stickerId: msg.stickerId || msg.sticker_id,
        gifUrl: msg.gifUrl || msg.gif_url,
        editedAt: msg.editedAt ? (typeof msg.editedAt === 'string' ? new Date(msg.editedAt).getTime() : msg.editedAt) : undefined,
        deletedAt: msg.deletedAt ? (typeof msg.deletedAt === 'string' ? new Date(msg.deletedAt).getTime() : msg.deletedAt) : undefined,
        expiresAt: msg.expiresAt ? (typeof msg.expiresAt === 'string' ? new Date(msg.expiresAt).getTime() : msg.expiresAt) : undefined,
        createdAt: msg.createdAt ? (typeof msg.createdAt === 'string' ? new Date(msg.createdAt).getTime() : (typeof msg.createdAt === 'number' ? msg.createdAt : Date.now())) : Date.now(),
      }));
      
      setSearchResults(formattedResults);
    } catch (e: any) {
      console.error('Failed to search messages:', e);
      setSearchResults([]);
      if (e.message && !e.message.includes('bad_request')) {
        showToast(getErrorMessage(e, 'ÐŸÐ¾Ð¸ÑÐº Ð½Ðµ Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½. ÐŸÐ¾Ð¿Ñ€Ð¾Ð±ÑƒÐ¹Ñ‚Ðµ ÑÐ½Ð¾Ð²Ð°.'), 'error');
      }
    }
  };

  // ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ° Ð³ÐµÐ¾Ð»Ð¾ÐºÐ°Ñ†Ð¸Ð¸
  const sendLocation = async (lat: number, lng: number, address?: string) => {
    try {
      // Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ñ Ñ‚ÐµÐºÑÑ‚Ð¾Ð¼ Ð»Ð¾ÐºÐ°Ñ†Ð¸Ð¸
      const locationText = address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const msg = await api(`/api/chats/${chatId}/messages`, 'POST', {
        text: `ðŸ“ ${locationText}`
      });
      // Ð—Ð°Ñ‚ÐµÐ¼ Ð¿Ñ€Ð¸ÐºÑ€ÐµÐ¿Ð»ÑÐµÐ¼ ÐºÐ¾Ð¾Ñ€Ð´Ð¸Ð½Ð°Ñ‚Ñ‹
      await api(`/api/messages/${msg.message.id}/location`, 'POST', {
        lat,
        lng,
        address
      });
      showToast('Ð“ÐµÐ¾Ð»Ð¾ÐºÐ°Ñ†Ð¸Ñ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð°', 'success');
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ Ð³ÐµÐ¾Ð»Ð¾ÐºÐ°Ñ†Ð¸ÑŽ.'), 'error');
    }
  };

  // Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ Ñ‚Ñ€ÐµÐ´Ð°
  const createThread = async (name: string) => {
    try {
      const data = await api(`/api/chats/${chatId}/threads`, 'POST', {
        rootMessageId: threadRootMessageId,
        name: name.trim() || undefined
      });
      await loadThreads();
      setSelectedThreadId(data.thread.id);
      setShowThreads(true);
      setShowThreadModal(false);
      setThreadRootMessageId('');
      showToast('Ð¢Ñ€ÐµÐ´ ÑÐ¾Ð·Ð´Ð°Ð½', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒ Ð¾Ð±ÑÑƒÐ¶Ð´ÐµÐ½Ð¸Ðµ.'), 'error');
    }
  };

  const MAX_ATTACHMENT_MB = 50;
  const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

  // ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ° Ñ„Ð°Ð¹Ð»Ð° Ñ Ð¿Ñ€Ð¾Ð³Ñ€ÐµÑÑÐ¾Ð¼ Ð¸ ÑÐ¶Ð°Ñ‚Ð¸ÐµÐ¼
  const sendFile = async (file: File, isVoiceMessage: boolean = false) => {
    try {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        showToast(`Ð¤Ð°Ð¹Ð» ÑÐ»Ð¸ÑˆÐºÐ¾Ð¼ Ð±Ð¾Ð»ÑŒÑˆÐ¾Ð¹. ÐœÐ°ÐºÑ. ${MAX_ATTACHMENT_MB} ÐœÐ‘`, 'error');
        return;
      }
      let fileToUpload = file;
      let vaultEnvelope: VaultEnvelope | null = null;

      // Ð¡Ð¶Ð¸Ð¼Ð°ÐµÐ¼ Ð¸Ð·Ð¾Ð±Ñ€Ð°Ð¶ÐµÐ½Ð¸Ñ ÐµÑÐ»Ð¸ Ð½ÑƒÐ¶Ð½Ð¾
      if (!isVoiceMessage && file.type.startsWith('image/') && shouldCompressImage(file)) {
        try {
          fileToUpload = await compressImage(file, { maxSizeKB: 500, quality: 0.8 });
          showToast('Ð˜Ð·Ð¾Ð±Ñ€Ð°Ð¶ÐµÐ½Ð¸Ðµ ÑÐ¶Ð°Ñ‚Ð¾', 'info');
        } catch (e) {
          console.warn('Failed to compress image, using original:', e);
        }
      }

      // Vault-first: ÑˆÐ¸Ñ„Ñ€ÑƒÐµÐ¼ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð¾Ð¼ Ð´Ð¾ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸
      if (!isVoiceMessage) {
        const encrypted = await encryptFileForVault(fileToUpload);
        fileToUpload = encrypted.encryptedFile;
        vaultEnvelope = encrypted.envelope;
      }
      
      const form = new FormData();
      form.append('file', fileToUpload);
      
      // Ð”Ð»Ñ Ð³Ð¾Ð»Ð¾ÑÐ¾Ð²Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ ÑÐ¿ÐµÑ†Ð¸Ð°Ð»ÑŒÐ½Ð¾Ðµ Ð¸Ð¼Ñ Ð¿Ð¾Ð»Ñ
      if (isVoiceMessage) {
        form.append('kind', 'voice');
      }
      
      // Ð¡Ð¾Ð·Ð´Ð°ÐµÐ¼ Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ñ Ð¿Ñ€Ð¾Ð³Ñ€ÐµÑÑÐ¾Ð¼
      const tempId = 'temp-upload-' + Date.now();
      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.id,
        text: '',
        attachmentUrl: URL.createObjectURL(file),
        uploadProgress: 0,
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, tempMessage]);
      
      const xhr = new XMLHttpRequest();
      
      // ÐžÑ‚ÑÐ»ÐµÐ¶Ð¸Ð²Ð°ÐµÐ¼ Ð¿Ñ€Ð¾Ð³Ñ€ÐµÑÑ
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setMessages(prev => prev.map(m => 
            m.id === tempId ? { ...m, uploadProgress: progress } : m
          ));
        }
      });
      
      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const attachmentUrl = data.url || data.attachmentUrl || data.attachment_url;
            
            if (!attachmentUrl) {
              throw new Error('ÐÐµ Ð¿Ð¾Ð»ÑƒÑ‡ÐµÐ½ URL Ð²Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ');
            }
            
            // Ð£Ð´Ð°Ð»ÑÐµÐ¼ Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ
            setMessages(prev => prev.filter(m => m.id !== tempId));
            
            // ÐžÑ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ñ Ð²Ð»Ð¾Ð¶ÐµÐ½Ð¸ÐµÐ¼
            const messagePayload: any = {
              text: isVoiceMessage ? '' : text.trim() || '', // Ð”Ð»Ñ Ð³Ð¾Ð»Ð¾ÑÐ¾Ð²Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð±ÐµÐ· Ñ‚ÐµÐºÑÑ‚Ð°
              attachmentUrl: attachmentUrl,
              replyTo: replyingTo?.id || null
            };
            if (vaultEnvelope) {
              messagePayload.document = {
                name: vaultEnvelope.name,
                type: vaultEnvelope.type,
                size: vaultEnvelope.size,
                previewUrl: attachmentUrl,
                vault: vaultEnvelope,
              };
            }

            const created = await api(`/api/chats/${chatId}/messages`, 'POST', messagePayload);

            if (vaultEnvelope) {
              const createdId = created?.id || created?.message?.id || `vault-${Date.now()}`;
              saveVaultRecord({
                id: createdId,
                chatId,
                attachmentUrl,
                createdAt: Date.now(),
                envelope: vaultEnvelope,
              });
            }
            
            if (!isVoiceMessage) {
              setText('');
              setReplyingTo(null);
            }
            
            await loadMessages(undefined, false);
            
            if (!isVoiceMessage) {
              showToast(vaultEnvelope ? 'Ð¤Ð°Ð¹Ð» Ð·Ð°ÑˆÐ¸Ñ„Ñ€Ð¾Ð²Ð°Ð½ Ð¸ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½ Ð² Vault' : 'Ð¤Ð°Ð¹Ð» Ð·Ð°Ð³Ñ€ÑƒÐ¶ÐµÐ½', 'success');
            }
          } catch (e: any) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            throw e;
          }
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          let errorData: any = {};
          try {
            errorData = JSON.parse(xhr.responseText || '{}');
          } catch {
            errorData = {};
          }
          throw new Error(errorData.error || errorData.detail || 'upload_error');
        }
      });
      
      xhr.addEventListener('error', () => {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        showToast('ÐžÑˆÐ¸Ð±ÐºÐ° Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ Ñ„Ð°Ð¹Ð»Ð°', 'error');
      });
      
      xhr.open('POST', `${getApiBaseUrl()}/api/chats/${chatId}/attach`);
      xhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('token'));
      xhr.send(form);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ñ„Ð°Ð¹Ð».'), 'error');
    }
  };

  // Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ Ð¾Ð¿Ñ€Ð¾ÑÐ°
  const createPoll = async (question: string, options: string[]) => {
    try {
      const response = await api(`/api/chats/${chatId}/messages`, 'POST', {
        poll: {
          question: question.trim(),
          options: options.filter(opt => opt.trim()).map(opt => ({ text: opt.trim() }))
        }
      });
      await loadMessages(undefined, false);
      showToast('ÐžÐ¿Ñ€Ð¾Ñ ÑÐ¾Ð·Ð´Ð°Ð½', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒ Ð¾Ð¿Ñ€Ð¾Ñ.'), 'error');
    }
  };
  
  // Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ ÐºÐ°Ð»ÐµÐ½Ð´Ð°Ñ€Ð½Ð¾Ð³Ð¾ ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ñ
  const createCalendarEvent = async (title: string, startTime: string, endTime?: string, location?: string, description?: string) => {
    try {
      await api(`/api/chats/${chatId}/messages`, 'POST', {
        calendarEvent: {
          title: title.trim(),
          startTime,
          endTime,
          location,
          description
        }
      });
      await loadMessages(undefined, false);
      showToast('Ð¡Ð¾Ð±Ñ‹Ñ‚Ð¸Ðµ ÑÐ¾Ð·Ð´Ð°Ð½Ð¾', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒ ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ðµ.'), 'error');
    }
  };
  
  // ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ° ÐºÐ¾Ð½Ñ‚Ð°ÐºÑ‚Ð°
  const sendContact = async (name: string, phone?: string, email?: string, avatar?: string) => {
    try {
      await api(`/api/chats/${chatId}/messages`, 'POST', {
        contact: {
          name: name.trim(),
          phone,
          email,
          avatar
        }
      });
      await loadMessages(undefined, false);
      showToast('ÐšÐ¾Ð½Ñ‚Ð°ÐºÑ‚ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ ÐºÐ¾Ð½Ñ‚Ð°ÐºÑ‚.'), 'error');
    }
  };
  
  // ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ° Ð´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ð°
  const sendDocument = async (file: File) => {
    await sendFile(file, false);
  };

  // Ð—Ð°ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ
  const pinMessage = async (messageId: string) => {
    try {
      await api(`/api/messages/${messageId}/pin`, 'POST');
      showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð¾', 'success');
      loadPinnedMessages();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
    }
  };

  // ÐžÑ‚ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ
  const unpinMessage = async (messageId: string) => {
    try {
      await api(`/api/messages/${messageId}/unpin`, 'POST');
      showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¾Ñ‚ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð¾', 'success');
      loadPinnedMessages();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
    }
  };

  // Ð“Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ
  const recordingStreamRef = useRef<MediaStream | null>(null);
  
  const startRecording = async () => {
    if (!chatId) {
      showToast('Ð’Ñ‹Ð±ÐµÑ€Ð¸Ñ‚Ðµ Ñ‡Ð°Ñ‚ Ð´Ð»Ñ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ', 'warning');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        // ÐžÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ Ð¿Ð¾Ñ‚Ð¾Ðº
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach(track => track.stop());
          recordingStreamRef.current = null;
        }
        
        if (chunks.length > 0) {
          try {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            
            // ÐžÑ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ Ñ„Ð°Ð¹Ð» Ñ‡ÐµÑ€ÐµÐ· sendFile Ñ Ñ„Ð»Ð°Ð³Ð¾Ð¼ Ð³Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ð³Ð¾ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
            await sendFile(file, true);
            showToast('Ð“Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¾', 'success');
          } catch (e: any) {
            showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ Ð³Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
          }
        }
        
        setRecordingTime(0);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      const startTime = Date.now();
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (e: any) {
      showToast('ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð½Ð°Ñ‡Ð°Ñ‚ÑŒ Ð·Ð°Ð¿Ð¸ÑÑŒ: ' + (e.message || 'unknown'), 'error');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // ÐžÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ Ð·Ð°Ð¿Ð¸ÑÑŒ
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // ÐžÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ Ð¿Ð¾Ñ‚Ð¾Ðº
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
      }
      
      // ÐžÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ Ð¸Ð½Ñ‚ÐµÑ€Ð²Ð°Ð»
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      setRecordingTime(0);
      showToast('Ð—Ð°Ð¿Ð¸ÑÑŒ Ð¾Ñ‚Ð¼ÐµÐ½ÐµÐ½Ð°', 'info');
    }
  };

  // Ð ÐµÐ°ÐºÑ†Ð¸Ñ
  const addReaction = async (messageId: string, emoji: string) => {
    try {
      await api(`/api/messages/${messageId}/react`, 'POST', { emoji });
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¿Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ñ€ÐµÐ°ÐºÑ†Ð¸ÑŽ.'), 'error');
    }
  };

  // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð´Ð¾ÑÑ‚ÑƒÐ¿Ð½Ñ‹Ñ… Ñ‡Ð°Ñ‚Ð¾Ð² Ð´Ð»Ñ Ð¿ÐµÑ€ÐµÑÑ‹Ð»ÐºÐ¸
  const loadAvailableChats = async () => {
    try {
      const data = await api('/api/chats');
      const chats = (data.chats || []).filter((c: any) => c.id !== chatId);
      setAvailableChats(chats.map((c: any) => ({
        id: c.id,
        name: c.name || c.members?.find((m: any) => m.userId !== currentUser.id)?.user?.username || 'Ð§Ð°Ñ‚',
        type: c.type || 'dm'
      })));
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ñ‡Ð°Ñ‚Ñ‹.'), 'error');
    }
  };

  // ÐŸÐµÑ€ÐµÑÑ‹Ð»ÐºÐ° ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
  const forwardMessage = async (targetChatId: string) => {
    if (!forwardMessageId) return;
    try {
      const message = messages.find(m => m.id === forwardMessageId);
      if (!message) {
        showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾', 'error');
        return;
      }
      
      await api(`/api/messages/${forwardMessageId}/forward`, 'POST', {
        targetChatId,
        comment: forwardComment.trim() || undefined
      });
      
      showToast('Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¿ÐµÑ€ÐµÑÐ»Ð°Ð½Ð¾', 'success');
      setShowForwardModal(false);
      setForwardMessageId(null);
      setForwardComment('');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¿ÐµÑ€ÐµÑÐ»Ð°Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
    }
  };

  // Ð’Ð²Ð¾Ð´ Ñ‚ÐµÐºÑÑ‚Ð° Ñ Ð¾Ñ‚ÑÐ»ÐµÐ¶Ð¸Ð²Ð°Ð½Ð¸ÐµÐ¼ Ð¿ÐµÑ‡Ð°Ñ‚Ð¸ Ð¸ ÑƒÐ¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ð¹
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    setText(newText);
    setCursorPosition(newCursorPos);
    
    // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ ÑƒÐ¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ñ
    const textBeforeCursor = newText.slice(0, newCursorPos);
    const mentionMatch = textBeforeCursor.match(/@([\w.-]*)$/);
    if (mentionMatch) {
      setMentionQuery({ query: mentionMatch[1], position: newCursorPos });
    } else {
      setMentionQuery(null);
    }

    if (socketRef.current) {
      sendOptimized('typing', { chatId, isTyping: true });
      setTimeout(() => {
        sendOptimized('typing', { chatId, isTyping: false });
      }, 3000);
    }
  };

  // ÐžÐ±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ° Ð²Ñ‹Ð±Ð¾Ñ€Ð° ÑƒÐ¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ñ
  const handleMentionSelect = (username: string) => {
    if (!mentionQuery) return;
    const textBefore = text.slice(0, mentionQuery.position - mentionQuery.query.length - 1);
    const textAfter = text.slice(mentionQuery.position);
    const newText = textBefore + '@' + username + ' ' + textAfter;
    setText(newText);
    setMentionQuery(null);
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = textBefore.length + username.length + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
        inputRef.current.focus();
      }
    }, 0);
  };

  // ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ° Ð¿Ð¾ Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery && (e.key === 'Enter' || e.key === 'Tab')) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(text);
    }
  };

  // ÐžÐ±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ° ÐºÐ»Ð¸ÐºÐ° Ð¿Ð¾ Ñ‚ÐµÐºÑÑ‚Ð¾Ð²Ð¾Ð¼Ñƒ Ð¿Ð¾Ð»ÑŽ
  const handleInputClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPosition(target.selectionStart || 0);
  };

  const handleInputSelectionChange = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  };

  const getUser = (userId: string): User => {
    return users.get(userId) || { id: userId, username: userId };
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ñ‡Ñ‚Ð¾';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} Ð¼Ð¸Ð½ Ð½Ð°Ð·Ð°Ð´`;
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSeparator = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dDay = new Date(d);
    dDay.setHours(0, 0, 0, 0);
    if (dDay.getTime() === today.getTime()) return 'Ð¡ÐµÐ³Ð¾Ð´Ð½Ñ';
    if (dDay.getTime() === yesterday.getTime()) return 'Ð’Ñ‡ÐµÑ€Ð°';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Ð ÐµÐ½Ð´ÐµÑ€Ð¸Ð½Ð³ Ñ‚ÐµÐºÑÑ‚Ð° ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ Ñ Ð¿Ð¾Ð´ÑÐ²ÐµÑ‚ÐºÐ¾Ð¹ ÑƒÐ¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ð¹ Ð¸ Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸ÐµÐ¼
  const renderMessageText = (messageText: string) => {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    
    // Ð£Ð»ÑƒÑ‡ÑˆÐµÐ½Ð½Ñ‹Ð¹ regex Ð´Ð»Ñ ÑƒÐ¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ð¹ - Ð¿Ð¾Ð´Ð´ÐµÑ€Ð¶Ð¸Ð²Ð°ÐµÑ‚ @username Ð¸ @username@domain
    const mentionRegex = /@([\w.-]+)/g;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const boldRegex = /\*\*(.+?)\*\*/g;
    const italicRegex = /\*(.+?)\*/g;
    const codeRegex = /`([^`]+)`/g;
    
    const matches: Array<{index: number, length: number, type: string, content: string}> = [];
    
    let match;
    while ((match = mentionRegex.exec(messageText)) !== null) {
      matches.push({ index: match.index, length: match[0].length, type: 'mention', content: match[1] });
    }
    
    urlRegex.lastIndex = 0;
    while ((match = urlRegex.exec(messageText)) !== null) {
      matches.push({ index: match.index, length: match[0].length, type: 'url', content: match[1] });
    }
    
    boldRegex.lastIndex = 0;
    while ((match = boldRegex.exec(messageText)) !== null) {
      matches.push({ index: match.index, length: match[0].length, type: 'bold', content: match[1] });
    }
    
    italicRegex.lastIndex = 0;
    while ((match = italicRegex.exec(messageText)) !== null) {
      const isPartOfBold = matches.some(m => m.type === 'bold' && match.index >= m.index && match.index < m.index + m.length);
      if (!isPartOfBold) {
        matches.push({ index: match.index, length: match[0].length, type: 'italic', content: match[1] });
      }
    }
    
    codeRegex.lastIndex = 0;
    while ((match = codeRegex.exec(messageText)) !== null) {
      matches.push({ index: match.index, length: match[0].length, type: 'code', content: match[1] });
    }
    
    matches.sort((a, b) => a.index - b.index);
    
    const priority: Record<string, number> = { code: 5, bold: 4, italic: 3, mention: 2, url: 1 };
    const filteredMatches = matches.filter((m, i) => {
      for (let j = 0; j < i; j++) {
        const other = matches[j];
        if (m.index < other.index + other.length && m.index + m.length > other.index) {
          if (priority[other.type] >= priority[m.type]) return false;
        }
      }
      return true;
    });
    
    filteredMatches.forEach(match => {
      if (match.index > lastIndex) {
        parts.push(messageText.slice(lastIndex, match.index));
      }
      
      switch (match.type) {
        case 'mention':
          // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÐµÑ‚ Ð»Ð¸ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ Ñ Ñ‚Ð°ÐºÐ¸Ð¼ username
          const mentionedUser = Array.from(users.values()).find(u => u.username.toLowerCase() === match.content.toLowerCase());
          parts.push(
            <span 
              key={match.index} 
              className="mention"
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (mentionedUser) {
                  setShowUserProfile(mentionedUser.id);
                }
              }}
              title={mentionedUser ? `ÐŸÑ€Ð¾Ñ„Ð¸Ð»ÑŒ ${mentionedUser.username}` : `@${match.content}`}
            >
              @{match.content}
            </span>
          );
          break;
        case 'url':
          // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, ÑÐ²Ð»ÑÐµÑ‚ÑÑ Ð»Ð¸ ÑÑ‚Ð¾ Ð²Ð¸Ð´ÐµÐ¾ URL
          if (isVideoUrl(match.content)) {
            parts.push(
              <div key={match.index} style={{ marginTop: '8px' }}>
                <VideoEmbed url={match.content} />
              </div>
            );
          } else {
            parts.push(<a key={match.index} href={match.content} target="_blank" rel="noreferrer" className="message-link">{match.content}</a>);
          }
          break;
        case 'bold':
          parts.push(<strong key={match.index}>{match.content}</strong>);
          break;
        case 'italic':
          parts.push(<em key={match.index}>{match.content}</em>);
          break;
        case 'code':
          parts.push(
            <code 
              key={match.index} 
              className="message-code"
              style={{
                background: 'var(--bg-tertiary)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.9em'
              }}
            >
              {match.content}
            </code>
          );
          break;
      }
      
      lastIndex = match.index + match.length;
    });
    
    if (lastIndex < messageText.length) {
      parts.push(messageText.slice(lastIndex));
    }
    
    return parts.length > 0 ? <>{parts}</> : messageText;
  };

  if (inGroupCall) {
    return (
      <GroupVideoCall
        chatId={chatId}
        currentUserId={currentUser.id}
        onClose={() => { setInGroupCall(false); setGroupCallVoiceOnly(false); }}
        startWithVideo={!groupCallVoiceOnly}
      />
    );
  }

  if (inDMCall) {
    const otherMemberId = chatInfoRef.current?.members.find(id => id !== currentUser.id) || inDMCall.otherUserId;
    if (otherMemberId) {
      return (
        <DMCall
          chatId={chatId}
          otherUserId={otherMemberId}
          currentUserId={currentUser.id}
          currentUserName={currentUser.username}
          currentUserAvatar={currentUser.avatarUrl}
          isVideo={inDMCall.isVideo}
          isIncoming={inDMCall.isIncoming}
          offerData={inDMCall.offerData}
          onClose={() => setInDMCall(null)}
        />
      );
    }
  }

  return (
    <div className="enhanced-chat-window">
        <div className="chat-header">
          {onBack && (
            <button type="button" className="chat-back-btn-mobile" onClick={onBack} aria-label="ÐÐ°Ð·Ð°Ð´ Ðº ÑÐ¿Ð¸ÑÐºÑƒ Ñ‡Ð°Ñ‚Ð¾Ð²">
              â†
            </button>
          )}
          <div className="chat-title">
            {chatInfoRef.current ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: 0 }}>
                {chatInfoRef.current.type === 'dm' ? (() => {
                  const otherMemberId = chatInfoRef.current.members.find((id: string) => id !== currentUser.id);
                  const otherUser = otherMemberId ? users.get(otherMemberId) : null;
                  const displayName = otherUser?.username || chatInfoRef.current?.name || 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ';
                  const isOnline = otherUser?.status === 'online';
                  return (
                    <>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        color: 'var(--text-secondary)',
                      }}>
                        {otherUser?.avatarUrl ? (
                          <img src={otherUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          displayName[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: '600', display: 'block' }}>{displayName}</span>
                        <span style={{
                          fontSize: '12px',
                          color: isOnline ? 'var(--accent-primary, #7c6cff)' : 'var(--text-secondary)',
                          fontWeight: isOnline ? 500 : 400,
                        }}>
                          {isOnline ? 'Ð¾Ð½Ð»Ð°Ð¹Ð½' : 'Ð±Ñ‹Ð»(Ð°) Ð½ÐµÐ´Ð°Ð²Ð½Ð¾'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVerificationModal(true)}
                        title="ÐŸÐ¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Ð»Ð¸Ñ‡Ð½Ð¾ÑÑ‚Ð¸ / Ð¾Ñ‚Ð¿ÐµÑ‡Ð°Ñ‚Ð¾Ðº ÐºÐ»ÑŽÑ‡Ð°"
                        style={{
                          padding: '6px 10px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: 'var(--fg)',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        ðŸ›¡ï¸
                      </button>
                    </>
                  );
                })() : (
                  <>
                    {chatInfoRef.current.type === 'group' ? 'ðŸ‘¥' : 'ðŸ“¢'}
                    <span style={{ fontWeight: '600' }}>{chatInfoRef.current.name || 'Ð§Ð°Ñ‚'}</span>
                    {isE2EEEnabled && (chatInfoRef.current.type === 'group' || chatInfoRef.current.type === 'channel') && (
                      <span title="End-to-End Encryption Ð°ÐºÑ‚Ð¸Ð²ÐµÐ½" style={{ fontSize: '14px', color: '#10b981', marginLeft: '4px' }}>ðŸ”’</span>
                    )}
                  </>
                )}
              </div>
            ) : selectedThreadId ? (
            <div className="thread-header">
              <button onClick={() => { setSelectedThreadId(null); setShowThreads(false); }} className="back-btn">
                â† ÐÐ°Ð·Ð°Ð´
              </button>
              <span>{threads.find(t => t.id === selectedThreadId)?.name || 'Ð¢Ñ€ÐµÐ´'}</span>
            </div>
          ) : replyingTo ? (
            <div className="reply-preview" style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderLeft: '3px solid var(--accent-primary)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '2px', color: 'var(--text-primary)' }}>
                  ÐžÑ‚Ð²ÐµÑ‚ Ð½Ð° {users.get(replyingTo.senderId)?.username || 'Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ'}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {replyingTo.text ? (replyingTo.text.length > 50 ? replyingTo.text.slice(0, 50) + '...' : replyingTo.text) : 'Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ'}
                </div>
              </div>
              <button 
                onClick={() => setReplyingTo(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '18px',
                  marginLeft: 'var(--spacing-sm)',
                  transition: 'var(--transition-base)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title="ÐžÑ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð¾Ñ‚Ð²ÐµÑ‚"
              >
                âœ•
              </button>
            </div>
          ) : null}
        </div>
        <div className="chat-header-actions">
          <button
            className="search-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="ÐŸÐ¾Ð¸ÑÐº"
          >
            ðŸ”
          </button>
          <button
            className="media-gallery-btn"
            onClick={() => setShowMediaGallery(true)}
            title="ÐœÐµÐ´Ð¸Ð° Ð³Ð°Ð»ÐµÑ€ÐµÑ"
          >
            ðŸ“· ÐœÐµÐ´Ð¸Ð°
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="export-btn"
              onClick={() => setShowExportDialog(true)}
              title="Ð­ÐºÑÐ¿Ð¾Ñ€Ñ‚ Ð¸ÑÑ‚Ð¾Ñ€Ð¸Ð¸ Ñ‡Ð°Ñ‚Ð°"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                fontSize: '16px',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition-base)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ðŸ’¾
            </button>
            <button
              onClick={() => setShowStatistics(true)}
              title="Ð¡Ñ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸ÐºÐ° Ñ‡Ð°Ñ‚Ð°"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                fontSize: '16px',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition-base)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ðŸ“Š
            </button>
            {(chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && (
              <>
                <button
                  onClick={() => setShowBotManager(true)}
                  title="Ð‘Ð¾Ñ‚Ñ‹"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    fontSize: '16px',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ðŸ¤–
                </button>
                <button
                  onClick={() => setShowCalendar(true)}
                  title="ÐšÐ°Ð»ÐµÐ½Ð´Ð°Ñ€ÑŒ"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    fontSize: '16px',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ðŸ“…
                </button>
                <button
                  onClick={() => setShowTodos(true)}
                  title="Ð—Ð°Ð´Ð°Ñ‡Ð¸"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    fontSize: '16px',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  âœ…
                </button>
              </>
            )}
          </div>
          {pinnedMessages.length > 0 && (
            <button
              className="pinned-btn"
              onClick={() => setShowPinned(!showPinned)}
              title="Ð—Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð½Ñ‹Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ"
            >
              ðŸ“Œ {pinnedMessages.length}
            </button>
          )}
          {(chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && (
            <>
              <button
                className="threads-btn"
                onClick={() => setShowThreads(!showThreads)}
                title="ÐŸÐ¾ÐºÐ°Ð·Ð°Ñ‚ÑŒ Ñ‚Ñ€ÐµÐ´Ñ‹"
              >
                ðŸ’¬ Ð¢Ñ€ÐµÐ´Ñ‹ {threads.length > 0 && `(${threads.length})`}
              </button>
              <button
                className="settings-btn"
                onClick={() => setShowGroupSettings(true)}
                title={chatInfoRef.current?.type === 'group' ? 'ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð³Ñ€ÑƒÐ¿Ð¿Ñ‹' : 'ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ ÐºÐ°Ð½Ð°Ð»Ð°'}
              >
                âš™ï¸
              </button>
              <button
                className="call-btn"
                onClick={() => { setGroupCallVoiceOnly(true); setInGroupCall(true); }}
                title="Ð“Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ð¹ Ñ‡Ð°Ñ‚ (Ð±ÐµÐ· Ð²Ð¸Ð´ÐµÐ¾)"
              >
                ðŸ“ž Ð“Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ð¹
              </button>
              <button
                className="video-call-btn"
                onClick={() => { setGroupCallVoiceOnly(false); setInGroupCall(true); }}
                title="Ð’Ð¸Ð´ÐµÐ¾Ð·Ð²Ð¾Ð½Ð¾Ðº Ñ Ð´ÐµÐ¼Ð¾Ð½ÑÑ‚Ñ€Ð°Ñ†Ð¸ÐµÐ¹ ÑÐºÑ€Ð°Ð½Ð°"
              >
                ðŸ“¹ Ð’Ð¸Ð´ÐµÐ¾ / Ð­ÐºÑ€Ð°Ð½
              </button>
              {(isChatOwner || isPlatformAdmin) && (
                <button
                  className="delete-chat-btn"
                  onClick={async () => {
                    if (!confirm('Ð’Ñ‹ ÑƒÐ²ÐµÑ€ÐµÐ½Ñ‹, Ñ‡Ñ‚Ð¾ Ñ…Ð¾Ñ‚Ð¸Ñ‚Ðµ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ ÑÑ‚Ð¾Ñ‚ Ñ‡Ð°Ñ‚? Ð­Ñ‚Ð¾ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ Ð½ÐµÐ»ÑŒÐ·Ñ Ð¾Ñ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ.')) {
                      return;
                    }
                    try {
                      await api(`/api/chats/${chatId}`, 'DELETE');
                      showToast('Ð§Ð°Ñ‚ ÑƒÐ´Ð°Ð»ÐµÐ½', 'success');
                      window.location.href = '/app/chats';
                    } catch (e: any) {
                      showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ.'), 'error');
                    }
                  }}
                  title="Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ñ‡Ð°Ñ‚"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    fontSize: '16px',
                    color: 'var(--danger)',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'var(--transition-base)'
                  }}
                >
                  ðŸ—‘ï¸
                </button>
              )}
            </>
          )}
          {chatInfoRef.current?.type === 'dm' && (
            <>
              <button
                className="call-btn"
                onClick={() => {
                  const otherMemberId = chatInfoRef.current?.members.find(id => id !== currentUser.id);
                  if (otherMemberId) {
                    playCallSound();
                    setInDMCall({ isVideo: false, otherUserId: otherMemberId });
                  }
                }}
                title="Ð—Ð²Ð¾Ð½Ð¾Ðº"
              >
                ðŸ“ž
              </button>
              <button
                className="video-call-btn"
                onClick={() => {
                  const otherMemberId = chatInfoRef.current?.members.find(id => id !== currentUser.id);
                  if (otherMemberId) {
                    playCallSound();
                    setInDMCall({ isVideo: true, otherUserId: otherMemberId });
                  }
                }}
                title="Ð’Ð¸Ð´ÐµÐ¾Ð·Ð²Ð¾Ð½Ð¾Ðº"
              >
                ðŸ“¹
              </button>
            </>
          )}
          <button
            className="call-history-btn"
            onClick={() => setShowCallHistory(true)}
            title="Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ Ð·Ð²Ð¾Ð½ÐºÐ¾Ð²"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '16px',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
              transition: 'var(--transition-base)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ðŸ“ž
          </button>
          <button
            className="appearance-btn"
            onClick={() => setShowAppearanceSettings(true)}
            title="Ð’Ð½ÐµÑˆÐ½Ð¸Ð¹ Ð²Ð¸Ð´ Ñ‡Ð°Ñ‚Ð°"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '16px',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
              transition: 'var(--transition-base)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ðŸŽ¨
          </button>
          <button
            className="settings-btn"
            onClick={() => {
              if (chatInfoRef.current?.type === 'dm') {
                const otherMemberId = chatInfoRef.current.members.find(id => id !== currentUser.id);
                if (otherMemberId) {
                  setShowUserProfile(otherMemberId);
                }
              } else {
                setShowGroupSettings(true);
              }
            }}
            title={chatInfoRef.current?.type === 'dm' ? 'ÐŸÑ€Ð¾Ñ„Ð¸Ð»ÑŒ' : 'ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸'}
          >
            {chatInfoRef.current?.type === 'dm' ? 'ðŸ‘¤' : 'âš™ï¸'}
          </button>
          {onClose && <button className="close-btn" onClick={onClose}>âœ•</button>}
        </div>
      </div>

      {/* ÐŸÐ¾Ð¸ÑÐº Ð¿Ð¾ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑÐ¼ */}
      {showSearch && (
        <div className="message-search">
          <div className="search-header">
            <input
              type="text"
              placeholder="ÐŸÐ¾Ð¸ÑÐº Ð¿Ð¾ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑÐ¼..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) {
                  searchMessages(e.target.value);
                } else {
                  setSearchResults([]);
                }
              }}
              className="search-input"
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
              âœ•
            </button>
          </div>
          {searchQuery.trim() && (
            <div className="search-results">
              {searchResults.length > 0 ? (
                searchResults.map(result => {
                  const sender = getUser(result.senderId);
                  const queryLower = searchQuery.toLowerCase();
                  const textLower = (result.text || '').toLowerCase();
                  const matchIndex = textLower.indexOf(queryLower);
                  
                  // Ð’Ñ‹Ð´ÐµÐ»ÑÐµÐ¼ Ð½Ð°Ð¹Ð´ÐµÐ½Ð½Ñ‹Ð¹ Ñ‚ÐµÐºÑÑ‚
                  const renderHighlightedText = (text: string) => {
                    if (!text || matchIndex === -1) return text;
                    const before = text.substring(0, matchIndex);
                    const match = text.substring(matchIndex, matchIndex + searchQuery.length);
                    const after = text.substring(matchIndex + searchQuery.length);
                    return (
                      <>
                        {before}
                        <mark style={{ background: 'var(--accent-primary)', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>
                          {match}
                        </mark>
                        {after}
                      </>
                    );
                  };
                  
                  return (
                    <div
                      key={result.id}
                      className="search-result-item"
                      onClick={async () => {
                        // Ð•ÑÐ»Ð¸ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð½Ðµ Ð² Ñ‚ÐµÐºÑƒÑ‰ÐµÐ¼ ÑÐ¿Ð¸ÑÐºÐµ, Ð·Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ
                        if (!messages.find(m => m.id === result.id)) {
                          await loadMessages(undefined, false);
                        }
                        
                        // ÐŸÑ€Ð¾ÐºÑ€ÑƒÑ‚ÐºÐ° Ðº ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑŽ
                        setTimeout(() => {
                          const element = document.querySelector(`[data-message-id="${result.id}"]`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('highlight');
                            setTimeout(() => element.classList.remove('highlight'), 2000);
                          }
                        }, 300);
                        
                        setShowSearch(false);
                      }}
                    >
                      <div className="search-result-header">
                        <div className="search-result-sender">
                          {sender.avatarUrl ? (
                            <img src={sender.avatarUrl} alt={sender.username} className="search-result-avatar" />
                          ) : (
                            <div className="search-result-avatar-placeholder">
                              {sender.username[0].toUpperCase()}
                            </div>
                          )}
                          <span className="search-result-username">{sender.username}</span>
                        </div>
                        <div className="search-result-time">{formatTime(result.createdAt)}</div>
                      </div>
                      <div className="search-result-text">
                        {result.text ? (
                          result.text.length > 150 ? (
                            <>
                              {renderHighlightedText(result.text.slice(0, 150))}
                              <span style={{ color: 'var(--text-tertiary)' }}>...</span>
                            </>
                          ) : (
                            renderHighlightedText(result.text)
                          )
                        ) : result.attachmentUrl ? (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>ðŸ“Ž Ð’Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ</span>
                        ) : result.stickerId ? (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>ðŸŽ¨ Ð¡Ñ‚Ð¸ÐºÐµÑ€</span>
                        ) : result.gifUrl ? (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>ðŸŽ¬ GIF</span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð±ÐµÐ· Ñ‚ÐµÐºÑÑ‚Ð°</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : searchQuery.trim() && (
                <div className="search-results-empty">
                  ÐÐ¸Ñ‡ÐµÐ³Ð¾ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ÐŸÐ°Ð½ÐµÐ»ÑŒ Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð½Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ */}
      {showPinned && (
        <div className="pinned-messages-panel" style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          width: '350px',
          maxHeight: '500px',
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div className="pinned-messages-header" style={{
            padding: 'var(--spacing-md)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary)'
          }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              ðŸ“Œ Ð—Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð½Ñ‹Ðµ ({pinnedMessages.length})
            </h4>
            <button 
              onClick={() => setShowPinned(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition-base)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              âœ•
            </button>
          </div>
          <div className="pinned-messages-list" style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-sm)'
          }}>
            {pinnedMessages.length === 0 ? (
              <div style={{
                padding: 'var(--spacing-lg)',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic'
              }}>
                ÐÐµÑ‚ Ð·Ð°ÐºÑ€ÐµÐ¿Ð»ÐµÐ½Ð½Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹
              </div>
            ) : (
              pinnedMessages.map((pinnedMsg) => {
                const pinnedSender = getUser(pinnedMsg.senderId);
                return (
                  <div
                    key={pinnedMsg.id}
                    className="pinned-message-item"
                    onClick={() => {
                      // ÐŸÑ€Ð¾ÐºÑ€ÑƒÑ‚ÐºÐ° Ðº ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑŽ
                      const element = document.querySelector(`[data-message-id="${pinnedMsg.id}"]`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('highlight');
                        setTimeout(() => element.classList.remove('highlight'), 2000);
                      }
                      setShowPinned(false);
                    }}
                    style={{
                      padding: 'var(--spacing-sm)',
                      marginBottom: 'var(--spacing-xs)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'var(--transition-base)',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <div className="pinned-message-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      <div className="pinned-message-sender" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        flex: 1,
                        minWidth: 0
                      }}>
                        {pinnedSender.avatarUrl ? (
                          <img 
                            src={pinnedSender.avatarUrl} 
                            alt={pinnedSender.username} 
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#fff'
                          }}>
                            {pinnedSender.username[0].toUpperCase()}
                          </div>
                        )}
                        <span style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {pinnedSender.username}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-tertiary)',
                        flexShrink: 0,
                        marginLeft: 'var(--spacing-xs)'
                      }}>
                        {formatTime(pinnedMsg.createdAt)}
                      </div>
                    </div>
                    <div className="pinned-message-text" style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {pinnedMsg.text ? (
                        pinnedMsg.text.length > 120 ? (
                          pinnedMsg.text.slice(0, 120) + '...'
                        ) : (
                          pinnedMsg.text
                        )
                      ) : pinnedMsg.attachmentUrl ? (
                        <span style={{ fontStyle: 'italic' }}>ðŸ“Ž Ð’Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ</span>
                      ) : pinnedMsg.stickerId ? (
                        <span style={{ fontStyle: 'italic' }}>ðŸŽ¨ Ð¡Ñ‚Ð¸ÐºÐµÑ€</span>
                      ) : pinnedMsg.gifUrl ? (
                        <span style={{ fontStyle: 'italic' }}>ðŸŽ¬ GIF</span>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð±ÐµÐ· Ñ‚ÐµÐºÑÑ‚Ð°</span>
                      )}
                    </div>
                    {(isChatOwner || isPlatformAdmin || pinnedMsg.senderId === currentUser.id) && (
                      <button
                        className="pinned-unpin-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          unpinMessage(pinnedMsg.id);
                        }}
                        title="ÐžÑ‚ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ"
                        style={{
                          position: 'absolute',
                          top: 'var(--spacing-xs)',
                          right: 'var(--spacing-xs)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '4px',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'var(--transition-base)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--accent-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-tertiary)';
                        }}
                      >
                        ðŸ“Œ
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {maintenance?.isActive && (
        <div
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, rgba(255,193,7,0.15), rgba(255,152,0,0.15))',
            borderBottom: '1px solid rgba(255,152,0,0.3)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>âš ï¸</span>
          <span>{maintenance.message || 'Ð’ÐµÐ´ÑƒÑ‚ÑÑ Ñ‚ÐµÑ…Ð½Ð¸Ñ‡ÐµÑÐºÐ¸Ðµ Ñ€Ð°Ð±Ð¾Ñ‚Ñ‹.'}</span>
          {maintenance.timestamp && (
            <span style={{ opacity: 0.8, fontSize: '12px' }}> â€¢ {maintenance.timestamp}</span>
          )}
        </div>
      )}

      <div 
        ref={messagesContainerRef}
        className="messages-container chat-messages"
        onScroll={handleScroll}
      >
        {/* ÐšÐ½Ð¾Ð¿ÐºÐ° Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸ ÑÑ‚Ð°Ñ€Ñ‹Ñ… ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ */}
        {hasMoreMessages && (
          <div style={{ 
            padding: 'var(--spacing-md)', 
            textAlign: 'center',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <button
              onClick={loadMoreMessages}
              disabled={loadingMoreMessages}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: loadingMoreMessages ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: loadingMoreMessages ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: loadingMoreMessages ? 0.6 : 1
              }}
            >
              {loadingMoreMessages ? 'â³ Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ°...' : 'â¬†ï¸ Ð—Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ ÑÑ‚Ð°Ñ€Ñ‹Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ'}
            </button>
          </div>
        )}
        {messages.length === 0 && !loadingMoreMessages && (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">ðŸ’¬</div>
            <h3 className="chat-empty-title">ÐÐµÑ‚ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹</h3>
            <p className="chat-empty-desc">ÐÐ°Ð¿Ð¸ÑˆÐ¸Ñ‚Ðµ Ð¿ÐµÑ€Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð¸Ð»Ð¸ Ð¿Ñ€Ð¸ÐºÑ€ÐµÐ¿Ð¸Ñ‚Ðµ Ñ„Ð°Ð¹Ð»</p>
            <p className="chat-empty-hint">Ð”Ð²Ð¾Ð¹Ð½Ð¾Ð¹ ÐºÐ»Ð¸Ðº Ð¿Ð¾ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑŽ â€” Ð¾Ñ‚Ð²ÐµÑ‚Ð¸Ñ‚ÑŒ</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const sender = getUser(msg.senderId);
          const isMe = msg.senderId === currentUser.id;
          const msgReactions = (reactions.get(msg.id) || []) as Array<{userId: string, emoji: string}>;
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
          const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : '';
          const thisDate = new Date(msg.createdAt).toDateString();
          const showDateSeparator = prevDate !== thisDate;

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="message-date-separator">
                  <span>{formatDateSeparator(msg.createdAt)}</span>
                </div>
              )}
            <div 
              data-message-id={msg.id} 
              className={`message-wrapper message ${isMe ? 'message-me me' : ''} ${msg.expiresAt && msg.expiresAt < Date.now() ? 'expired' : ''} ${msg.senderId === currentUser.id ? 'sending' : 'received'} ${messageIdWithActions === msg.id ? 'show-actions' : ''}`}
              style={{ animationDelay: `${idx * 0.03}s` }}
              onDoubleClick={() => !msg.deletedAt && setReplyingTo(msg)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMessageIdWithActions(prev => prev === msg.id ? null : msg.id);
              }}
              onTouchStart={() => {
                longPressTimerRef.current = setTimeout(() => setMessageIdWithActions(msg.id), 400);
              }}
              onTouchEnd={() => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              }}
              onTouchCancel={() => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              }}
            >
              {!isMe && showAvatar && (
                <div 
                  className="message-avatar"
                  onClick={() => setShowUserProfile(msg.senderId)}
                  style={{ cursor: 'pointer' }}
                >
                  {sender.avatarUrl ? (
                    <img src={sender.avatarUrl} alt={sender.username} />
                  ) : (
                    <div className="avatar-placeholder">{sender.username[0].toUpperCase()}</div>
                  )}
                </div>
              )}
              <div className="message-content">
                {!isMe && showAvatar && (
                  <div className="message-sender" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <UsernameWithRole user={sender} username={sender.username} showBadge showColor />
                    {serverMemberRoles?.[msg.senderId]?.map((role) => (
                      <span
                        key={role.id}
                        style={{
                          fontSize: 10,
                          padding: '2px 5px',
                          borderRadius: 4,
                          background: `#${(role.color || '').replace(/^#/, '')}20`,
                          color: `#${(role.color || '').replace(/^#/, '')}`,
                          fontWeight: 500,
                        }}
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                )}
                {msg.threadId && (
                  <div className="message-thread-indicator" style={{ 
                    padding: '4px 8px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                    display: 'inline-block'
                  }}>
                    ðŸ’¬ Ð¢Ñ€ÐµÐ´: {threads.find(t => t.id === msg.threadId)?.name || 'Ð¢Ñ€ÐµÐ´'}
                  </div>
                )}
                {msg.replyTo && (
                  <div 
                    className="message-reply"
                    onClick={() => {
                      // ÐŸÑ€Ð¾ÐºÑ€ÑƒÑ‚ÐºÐ° Ðº Ð¸ÑÑ…Ð¾Ð´Ð½Ð¾Ð¼Ñƒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑŽ
                      const replyMessage = msg.replyToMessage || messages.find(m => m.id === msg.replyTo);
                      if (replyMessage) {
                        const element = document.querySelector(`[data-message-id="${msg.replyTo}"]`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          element.classList.add('highlight');
                          setTimeout(() => element.classList.remove('highlight'), 2000);
                        }
                      }
                    }}
                    style={{ 
                      cursor: 'pointer',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '8px',
                      borderLeft: '3px solid var(--accent-primary)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      transition: 'var(--transition-base)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
                      {(() => {
                        const replyMsg = msg.replyToMessage || messages.find(m => m.id === msg.replyTo);
                        if (replyMsg) {
                          const replySender = users.get(replyMsg.senderId);
                          return `â†©ï¸ ÐžÑ‚Ð²ÐµÑ‚ Ð½Ð° ${replySender?.username || 'Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ'}`;
                        }
                        return 'â†©ï¸ ÐžÑ‚Ð²ÐµÑ‚ Ð½Ð° ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ';
                      })()}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '300px'
                    }}>
                      {(() => {
                        const replyMsg = msg.replyToMessage || messages.find(m => m.id === msg.replyTo);
                        if (replyMsg) {
                          if ('text' in replyMsg && replyMsg.text) {
                            return replyMsg.text.length > 50 ? replyMsg.text.slice(0, 50) + '...' : replyMsg.text;
                          }
                          if ('attachmentUrl' in replyMsg && replyMsg.attachmentUrl) return 'ðŸ“Ž Ð’Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ';
                          if ('stickerId' in replyMsg && replyMsg.stickerId) return 'ðŸŽ¨ Ð¡Ñ‚Ð¸ÐºÐµÑ€';
                          if ('gifUrl' in replyMsg && replyMsg.gifUrl) return 'ðŸŽ¬ GIF';
                        }
                        return 'Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ';
                      })()}
                    </div>
                  </div>
                )}
                {msg.forwardFrom && (
                  <div className="message-forward" style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '8px',
                    borderLeft: '3px solid var(--accent-secondary)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>âž¡ï¸ ÐŸÐµÑ€ÐµÑÐ»Ð°Ð½Ð¾</span>
                    {msg.forwardedMessage && (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                        Ð¾Ñ‚ {msg.forwardedMessage.sender?.username || 'Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ'}
                      </span>
                    )}
                  </div>
                )}
                {msg.forwardFrom && msg.forwardedMessage && (
                  <div className="forwarded-message-preview" style={{
                    padding: '8px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '8px',
                    borderLeft: '3px solid var(--accent-secondary)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
                      {msg.forwardedMessage.sender?.username || 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ'}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '300px'
                    }}>
                      {msg.forwardedMessage.text ? (
                        msg.forwardedMessage.text.length > 50 ? 
                          msg.forwardedMessage.text.slice(0, 50) + '...' : 
                          msg.forwardedMessage.text
                      ) : msg.forwardedMessage.attachmentUrl ? (
                        'ðŸ“Ž Ð’Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ'
                      ) : (
                        'Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ'
                      )}
                    </div>
                  </div>
                )}
                <div className="message-bubble">
                  {msg.stickerId && (
                    <div className="message-sticker" style={{
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {stickers.get(msg.stickerId) ? (
                        <img 
                          src={stickers.get(msg.stickerId)!.url} 
                          alt={stickers.get(msg.stickerId)!.emoji || 'sticker'} 
                          style={{
                            maxWidth: '200px',
                            maxHeight: '200px',
                            objectFit: 'contain'
                          }}
                        />
                      ) : (
                        <div style={{
                          padding: '16px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          color: 'var(--text-tertiary)',
                          fontStyle: 'italic'
                        }}>
                          Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° ÑÑ‚Ð¸ÐºÐµÑ€Ð°...
                        </div>
                      )}
                    </div>
                  )}
                  {msg.text && (
                    <div className="message-text">
                      {editingMessage?.id === msg.id ? (
                        <div className="message-edit-input">
                          <textarea
                            defaultValue={msg.text}
                            ref={(el) => {
                              if (el) {
                                el.focus();
                                el.setSelectionRange(el.value.length, el.value.length);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                editMessage(msg.id, e.currentTarget.value);
                              }
                              if (e.key === 'Escape') {
                                setEditingMessage(null);
                              }
                            }}
                            onBlur={(e) => {
                              if (e.currentTarget.value !== msg.text) {
                                editMessage(msg.id, e.currentTarget.value);
                              } else {
                                setEditingMessage(null);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <div 
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }}
                            style={{ wordWrap: 'break-word' }}
                          />
                          {/* ÐŸÑ€ÐµÐ²ÑŒÑŽ ÑÑÑ‹Ð»Ð¾Ðº */}
                          {(() => {
                            const urlRegex = /(https?:\/\/[^\s<]+)/g;
                            const urls: string[] = [];
                            let match;
                            const textCopy = msg.text;
                            urlRegex.lastIndex = 0;
                            while ((match = urlRegex.exec(textCopy)) !== null) {
                              if (!isVideoUrl(match[1])) {
                                urls.push(match[1]);
                              }
                            }
                            return urls.slice(0, 3).map((url, idx) => (
                              <LinkPreview key={idx} url={url} />
                            ));
                          })()}
                        </>
                      )}
                    </div>
                  )}
                  {/* ÐžÐ¿Ñ€Ð¾Ñ */}
                  {msg.pollId && msg.poll && (
                    <Poll
                      pollId={msg.pollId}
                      question={msg.poll.question}
                      options={msg.poll.options}
                      messageId={msg.id}
                      chatId={chatId}
                      currentUserId={currentUser.id}
                      canVote={msg.senderId !== currentUser.id}
                      totalVotes={msg.poll.totalVotes}
                    />
                  )}
                  {/* ÐšÐ°Ð»ÐµÐ½Ð´Ð°Ñ€Ð½Ð¾Ðµ ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ðµ */}
                  {msg.calendarEvent && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginTop: '8px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                        ðŸ“… {msg.calendarEvent.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        ðŸ• {new Date(msg.calendarEvent.startTime).toLocaleString('ru-RU')}
                        {msg.calendarEvent.endTime && ` - ${new Date(msg.calendarEvent.endTime).toLocaleString('ru-RU')}`}
                      </div>
                      {msg.calendarEvent.location && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          ðŸ“ {msg.calendarEvent.location}
                        </div>
                      )}
                      {msg.calendarEvent.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                          {msg.calendarEvent.description}
                        </div>
                      )}
                    </div>
                  )}
                  {/* ÐšÐ¾Ð½Ñ‚Ð°ÐºÑ‚ */}
                  {msg.contact && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginTop: '8px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center'
                    }}>
                      {msg.contact.avatar && (
                        <img src={msg.contact.avatar} alt={msg.contact.name} style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
                          ðŸ‘¤ {msg.contact.name}
                        </div>
                        {msg.contact.phone && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ðŸ“ž {msg.contact.phone}
                          </div>
                        )}
                        {msg.contact.email && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            âœ‰ï¸ {msg.contact.email}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Ð”Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚ */}
                  {msg.document && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginTop: '8px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: '32px' }}>ðŸ“„</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
                          {msg.document.vault ? `ðŸ” ${msg.document.name}` : msg.document.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {msg.document.type.toUpperCase()} â€¢ {(msg.document.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      {msg.document.vault && msg.attachmentUrl && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const attachmentUrl = msg.attachmentUrl!.startsWith('http')
                                ? msg.attachmentUrl!
                                : `${getApiBaseUrl()}${msg.attachmentUrl!.startsWith('/') ? '' : '/'}${msg.attachmentUrl!}`;
                              const resp = await fetch(attachmentUrl, {
                                headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
                              });
                              if (!resp.ok) throw new Error('vault_download_failed');
                              const encryptedBlob = await resp.blob();
                              const decryptedBlob = await decryptVaultBlob(encryptedBlob, msg.document.vault);
                              const blobUrl = URL.createObjectURL(decryptedBlob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = msg.document.vault.name || msg.document.name || 'file.bin';
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
                            } catch (e: any) {
                              showToast(getErrorMessage(e, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ñ€Ð°ÑÑˆÐ¸Ñ„Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ñ„Ð°Ð¹Ð» Vault.'), 'error');
                            }
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#7dd3fc',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Ð Ð°ÑÑˆÐ¸Ñ„Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ
                        </button>
                      )}
                      {msg.document.previewUrl && !msg.document.vault && (
                        <img src={msg.document.previewUrl} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                      )}
                    </div>
                  )}
                  {/* Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ Ñ€ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ */}
                  {msg.editHistory && msg.editHistory.length > 0 && (
                    <details style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: 'var(--text-tertiary)'
                    }}>
                      <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                        Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ Ñ€ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ ({msg.editHistory.length})
                      </summary>
                      <div style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                        {msg.editHistory.map((edit, idx) => (
                          <div key={idx} style={{ marginBottom: '4px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                              {new Date(edit.editedAt).toLocaleString('ru-RU')}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {edit.text.length > 100 ? edit.text.slice(0, 100) + '...' : edit.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {/* ÐŸÑ€Ð¾Ð³Ñ€ÐµÑÑ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ */}
                  {msg.uploadProgress !== undefined && msg.uploadProgress < 100 && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ°...</span>
                        <span>{msg.uploadProgress}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${msg.uploadProgress}%`,
                          height: '100%',
                          background: 'var(--accent-primary)',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  )}
                  {msg.attachmentUrl && !msg.document?.vault && (
                    <div className="message-attachment">
                      {(() => {
                        // Ð¤Ð¾Ñ€Ð¼Ð¸Ñ€ÑƒÐµÐ¼ Ð¿Ð¾Ð»Ð½Ñ‹Ð¹ URL Ð´Ð»Ñ Ð¼ÐµÐ´Ð¸Ð°Ñ„Ð°Ð¹Ð»Ð°
                        const attachmentUrl = msg.attachmentUrl.startsWith('http') 
                          ? msg.attachmentUrl 
                          : `${getApiBaseUrl()}${msg.attachmentUrl.startsWith('/') ? '' : '/'}${msg.attachmentUrl}`;
                        
                        if (msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                          return <img src={attachmentUrl} alt="attachment" style={{ maxWidth: '100%', borderRadius: '8px' }} />;
                        } else if (msg.attachmentUrl.match(/\.(mp4|webm)$/i)) {
                          return <video src={attachmentUrl} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />;
                        } else if (msg.attachmentUrl.match(/\.(mp3|wav|ogg|webm)$/i)) {
                          return (
                            <div style={{ marginTop: '8px' }}>
                              <AudioPlayer src={attachmentUrl} duration={msg.attachmentDuration} />
                            </div>
                          );
                        } else {
                          return (
                            <a href={attachmentUrl} target="_blank" rel="noreferrer" download>
                              ðŸ“Ž {msg.attachmentUrl.split('/').pop()}
                            </a>
                          );
                        }
                      })()}
                    </div>
                  )}
                  {msg.text && msg.text.includes('ðŸ“') && (
                    <div className="message-location">
                      <button
                        className="location-view-btn"
                        onClick={async () => {
                          try {
                            const location = await api(`/api/messages/${msg.id}/location`);
                            const url = `https://www.openstreetmap.org/?mlat=${location.location.lat}&mlon=${location.location.lng}&zoom=15`;
                            window.open(url, '_blank');
                          } catch (e) {
                            console.error('Failed to load location:', e);
                          }
                        }}
                      >
                        ðŸ“ ÐŸÐ¾ÐºÐ°Ð·Ð°Ñ‚ÑŒ Ð½Ð° ÐºÐ°Ñ€Ñ‚Ðµ
                      </button>
                    </div>
                  )}
                  <div className="message-meta">
                    <span>{formatTime(msg.createdAt)}</span>
                    {msg.editedAt && <span className="edited">(Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¾)</span>}
                    {isMe && (
                      <span className="read-status" title={(() => {
                        if (msg.readReceipts && msg.readReceipts.length > 0) {
                          const lastRead = msg.readReceipts[msg.readReceipts.length - 1];
                          return `ÐŸÑ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð½Ð¾ ${formatTime(lastRead.readAt)}`;
                        }
                        return 'ÐÐµ Ð¿Ñ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð½Ð¾';
                      })()}>
                        {(() => {
                          // Ð”Ð»Ñ DM Ñ‡Ð°Ñ‚Ð¾Ð² Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ Ð¿Ñ€Ð¾ÑÑ‚Ð¾Ð¹ ÑÑ‚Ð°Ñ‚ÑƒÑ
                          if (chatInfoRef.current?.type === 'dm') {
                            if (msg.readReceipts && msg.readReceipts.length > 0) {
                              return 'âœ“âœ“'; // ÐŸÑ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð½Ð¾ (Ð´Ð²Ð¾Ð¹Ð½Ð°Ñ Ð³Ð°Ð»Ð¾Ñ‡ÐºÐ°)
                            }
                            return 'âœ“'; // Ð”Ð¾ÑÑ‚Ð°Ð²Ð»ÐµÐ½Ð¾ (Ð¾Ð´Ð½Ð° Ð³Ð°Ð»Ð¾Ñ‡ÐºÐ°)
                          }
                          // Ð”Ð»Ñ Ð³Ñ€ÑƒÐ¿Ð¿Ð¾Ð²Ñ‹Ñ… Ñ‡Ð°Ñ‚Ð¾Ð² Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ ÐºÐ¾Ð»Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾ Ð¿Ñ€Ð¾Ñ‡Ð¸Ñ‚Ð°Ð²ÑˆÐ¸Ñ…
                          if (msg.readReceipts && msg.readReceipts.length > 0) {
                            return `âœ“âœ“ ${msg.readReceipts.length}`;
                          }
                          return 'âœ“';
                        })()}
                      </span>
                    )}
                  </div>
                </div>
                {msgReactions.length > 0 && (
                  <div className="message-reactions">
                    {Array.from(new Set(msgReactions.map(r => r.emoji))).map(emoji => (
                      <button
                        key={emoji}
                        className="reaction-btn"
                        onClick={() => addReaction(msg.id, emoji)}
                        title={msgReactions.filter(r => r.emoji === emoji).length + ' ' + emoji}
                      >
                        {emoji} {msgReactions.filter(r => r.emoji === emoji).length}
                      </button>
                    ))}
                  </div>
                )}
                <div className="message-actions">
                  <button onClick={() => addReaction(msg.id, 'ðŸ‘')}>ðŸ‘</button>
                  <button onClick={() => addReaction(msg.id, 'â¤ï¸')}>â¤ï¸</button>
                  <button onClick={() => setReplyingTo(msg)}>ÐžÑ‚Ð²ÐµÑ‚Ð¸Ñ‚ÑŒ</button>
                  <button onClick={() => {
                    setForwardMessageId(msg.id);
                    loadAvailableChats();
                    setShowForwardModal(true);
                  }} title="ÐŸÐµÑ€ÐµÑÐ»Ð°Ñ‚ÑŒ">
                    âž¡ï¸ ÐŸÐµÑ€ÐµÑÐ»Ð°Ñ‚ÑŒ
                  </button>
                  {savedMessages.has(msg.id) ? (
                    <button onClick={() => setSavedMessages(prev => { const next = new Set(prev); next.delete(msg.id); return next; })} title="Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ð¸Ð· Ð¸Ð·Ð±Ñ€Ð°Ð½Ð½Ð¾Ð³Ð¾">
                      â­
                    </button>
                  ) : (
                    <button onClick={() => setSavedMessages(prev => new Set(prev).add(msg.id))} title="Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ Ð² Ð¸Ð·Ð±Ñ€Ð°Ð½Ð½Ð¾Ðµ">
                      â˜†
                    </button>
                  )}
                  {(() => {
                    const isPinned = pinnedMessages.some(p => p.id === msg.id);
                    return isPinned ? (
                      <button onClick={() => unpinMessage(msg.id)} title="ÐžÑ‚ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ">
                        ðŸ“Œ
                      </button>
                    ) : (
                      <button onClick={() => pinMessage(msg.id)} title="Ð—Ð°ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ">
                        ðŸ“Œ
                      </button>
                    );
                  })()}
                  {msg.senderId === currentUser.id && (
                    <>
                      <button onClick={() => setEditingMessage(msg)} title="Ð ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ">
                        âœï¸
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ open: true, messageId: msg.id, deleteForAll: true })}
                        title="Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ð´Ð»Ñ Ð²ÑÐµÑ…"
                      >
                        ðŸ—‘ï¸
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ open: true, messageId: msg.id, deleteForAll: false })}
                        title="Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ð´Ð»Ñ Ð¼ÐµÐ½Ñ"
                      >
                        ðŸ—‘ï¸
                      </button>
                    </>
                  )}
                  {(chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && !msg.threadId && (
                    <button onClick={() => {
                      setThreadRootMessageId(msg.id);
                      setShowThreadModal(true);
                    }} title="Ð¡Ð¾Ð·Ð´Ð°Ñ‚ÑŒ Ñ‚Ñ€ÐµÐ´">
                      ðŸ’¬ Ð¢Ñ€ÐµÐ´
                    </button>
                  )}
                </div>
              </div>
            </div>
            </React.Fragment>
          );
        })}
        {typingUsers.size > 0 && (() => {
          const names = Array.from(typingUsers).map((userId: string) => getUser(userId).username || 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ');
          const text = names.length === 1
            ? `${names[0]} Ð¿ÐµÑ‡Ð°Ñ‚Ð°ÐµÑ‚...`
            : names.length === 2
              ? `${names[0]} Ð¸ ${names[1]} Ð¿ÐµÑ‡Ð°Ñ‚Ð°ÑŽÑ‚...`
              : names.length > 2
                ? `${names.slice(0, -1).join(', ')} Ð¸ ${names[names.length - 1]} Ð¿ÐµÑ‡Ð°Ñ‚Ð°ÑŽÑ‚...`
                : 'Ð¿ÐµÑ‡Ð°Ñ‚Ð°ÑŽÑ‚...';
          return (
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
              <span className="typing-indicator-names">{text}</span>
            </div>
          );
        })()}
        <div ref={messagesEndRef} />
      </div>

      {showScrollToBottom && messages.length > 0 && (
        <button
          type="button"
          className="scroll-to-bottom-fab"
          onClick={() => scrollToBottom(true)}
          title="Ð’Ð½Ð¸Ð· Ðº Ð½Ð¾Ð²Ñ‹Ð¼ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑÐ¼"
          aria-label="ÐŸÑ€Ð¾ÐºÑ€ÑƒÑ‚Ð¸Ñ‚ÑŒ Ð²Ð½Ð¸Ð·"
        >
          â†“
        </button>
      )}

      {/* Ð¡Ð¿Ð¸ÑÐ¾Ðº Ñ‚Ñ€ÐµÐ´Ð¾Ð² */}
      {showThreads && !selectedThreadId && (chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && (
        <div className="threads-sidebar">
          <div className="threads-header">
            <h4>Ð¢Ñ€ÐµÐ´Ñ‹</h4>
            <button onClick={() => setShowThreads(false)}>âœ•</button>
          </div>
          <div className="threads-list">
            {threads.length === 0 ? (
              <div className="empty-threads">ÐÐµÑ‚ Ñ‚Ñ€ÐµÐ´Ð¾Ð²</div>
            ) : (
              threads.map(thread => (
                <div
                  key={thread.id}
                  className="thread-item"
                  onClick={() => {
                    setSelectedThreadId(thread.id);
                    setShowThreads(false);
                  }}
                >
                  <div className="thread-name">{thread.name}</div>
                  <div className="thread-meta">
                    {thread.messageCount || 0} ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹
                    {thread.unreadCount > 0 && (
                      <span className="thread-unread">{thread.unreadCount}</span>
                    )}
                  </div>
                  {thread.lastMessage && (
                    <div className="thread-preview">{thread.lastMessage.text?.slice(0, 40)}...</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ÐœÐµÐ´Ð¸Ð° Ð³Ð°Ð»ÐµÑ€ÐµÑ */}
      {showMediaGallery && (
        <div className="media-gallery-overlay">
          <MediaGallery
            chatId={chatId}
            onClose={() => setShowMediaGallery(false)}
          />
        </div>
      )}

      {/* ÐŸÑ€Ð¾Ñ„Ð¸Ð»ÑŒ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ */}
      {showUserProfile && (
        <div className="user-profile-overlay">
          <UserProfile
            userId={showUserProfile}
            currentUserId={currentUser.id}
            onClose={() => setShowUserProfile(null)}
          />
        </div>
      )}

      {/* ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð³Ñ€ÑƒÐ¿Ð¿Ñ‹/ÐºÐ°Ð½Ð°Ð»Ð° */}
      {showGroupSettings && chatInfoRef.current?.type && (chatInfoRef.current.type === 'group' || chatInfoRef.current.type === 'channel') && (
        <GroupChannelSettings
          chatId={chatId}
          chatType={chatInfoRef.current.type}
          currentUserId={currentUser.id}
          onClose={() => setShowGroupSettings(false)}
          onUpdate={() => {
            loadChatInfo();
            loadMessages();
          }}
        />
      )}

      {/* Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ Ð·Ð²Ð¾Ð½ÐºÐ¾Ð² */}
      {showCallHistory && (
        <CallHistory
          chatId={chatId}
          currentUserId={currentUser.id}
          onClose={() => setShowCallHistory(false)}
        />
      )}

      {/* ÐÐ°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð²Ð½ÐµÑˆÐ½ÐµÐ³Ð¾ Ð²Ð¸Ð´Ð° */}
      {showAppearanceSettings && (
        <AppearanceSettings
          chatId={chatId}
          onClose={() => setShowAppearanceSettings(false)}
        />
      )}

      {/* Ð­ÐºÑÐ¿Ð¾Ñ€Ñ‚ Ñ‡Ð°Ñ‚Ð° */}
      {showExportDialog && (
        <ExportChatDialog
          chatId={chatId}
          chatName={chatInfoRef.current?.type === 'dm' 
            ? (() => {
                const otherMemberId = chatInfoRef.current?.members?.find((id: string) => id !== currentUser.id);
                const otherUser = otherMemberId ? users.get(otherMemberId) : null;
                return otherUser?.username || chatInfoRef.current?.name || 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ';
              })()
            : (chatInfoRef.current?.name || 'Ð§Ð°Ñ‚')}
          messages={messages}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Ð¡Ñ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸ÐºÐ° Ñ‡Ð°Ñ‚Ð° */}
      {showStatistics && (
        <ChatStatistics
          chatId={chatId}
          onClose={() => setShowStatistics(false)}
        />
      )}

      {/* Ð ÐµÐ·ÐµÑ€Ð²Ð½Ð¾Ðµ ÐºÐ¾Ð¿Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ðµ */}
      {showBackupManager && (
        <BackupManager
          onClose={() => setShowBackupManager(false)}
        />
      )}

      {/* Ð£Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð±Ð¾Ñ‚Ð°Ð¼Ð¸ */}
      {showBotManager && (
        <BotManager
          chatId={chatId}
          onClose={() => setShowBotManager(false)}
        />
      )}

      {/* ÐšÐ°Ð»ÐµÐ½Ð´Ð°Ñ€ÑŒ */}
      {showCalendar && (
        <CalendarIntegration
          chatId={chatId}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Ð—Ð°Ð´Ð°Ñ‡Ð¸ */}
      {showTodos && (
        <TodoIntegration
          chatId={chatId}
          onClose={() => setShowTodos(false)}
        />
      )}

      {/* ÐœÐ¾Ð´Ð°Ð»ÑŒÐ½Ð¾Ðµ Ð¾ÐºÐ½Ð¾ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ñ‚Ñ€ÐµÐ´Ð° */}
      <PromptModal
        isOpen={showThreadModal}
        onClose={() => {
          setShowThreadModal(false);
          setThreadRootMessageId('');
        }}
        onConfirm={createThread}
        title="Ð¡Ð¾Ð·Ð´Ð°Ñ‚ÑŒ Ñ‚Ñ€ÐµÐ´"
        message="Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ Ñ‚Ñ€ÐµÐ´Ð° (Ð½ÐµÐ¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÐ½Ð¾):"
        placeholder="ÐÐ°Ð·Ð²Ð°Ð½Ð¸Ðµ Ñ‚Ñ€ÐµÐ´Ð°"
        defaultValue=""
        confirmText="Ð¡Ð¾Ð·Ð´Ð°Ñ‚ÑŒ"
        cancelText="ÐžÑ‚Ð¼ÐµÐ½Ð°"
      />

      {/* ÐœÐ¾Ð´Ð°Ð»ÑŒÐ½Ð¾Ðµ Ð¾ÐºÐ½Ð¾: Ð¾Ñ‚Ð¿ÐµÑ‡Ð°Ñ‚Ð¾Ðº ÐºÐ»ÑŽÑ‡Ð° / Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Ð»Ð¸Ñ‡Ð½Ð¾ÑÑ‚Ð¸ */}
      {showVerificationModal && chatInfoRef.current?.type === 'dm' && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={() => setShowVerificationModal(false)}>
          <div className="modal-content" style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>ðŸ›¡ï¸ ÐŸÐ¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Ð»Ð¸Ñ‡Ð½Ð¾ÑÑ‚Ð¸</h3>
              <button type="button" onClick={() => setShowVerificationModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontSize: '20px' }}>âœ•</button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--subtle)', marginBottom: '16px', lineHeight: 1.5 }}>
              Ð¡Ñ€Ð°Ð²Ð½Ð¸Ñ‚Ðµ ÑÑ‚Ð¾Ñ‚ Ð¾Ñ‚Ð¿ÐµÑ‡Ð°Ñ‚Ð¾Ðº Ñ Ð¾Ñ‚Ð¿ÐµÑ‡Ð°Ñ‚ÐºÐ¾Ð¼ Ð½Ð° ÑƒÑÑ‚Ñ€Ð¾Ð¹ÑÑ‚Ð²Ðµ ÑÐ¾Ð±ÐµÑÐµÐ´Ð½Ð¸ÐºÐ°. ÐŸÑ€Ð¸ Ð¿Ð¾Ð»Ð½Ð¾Ð¼ E2E Ð·Ð´ÐµÑÑŒ Ð±ÑƒÐ´ÐµÑ‚ Ð¾Ñ‚Ð¾Ð±Ñ€Ð°Ð¶Ð°Ñ‚ÑŒÑÑ Ð¾Ñ‚Ð¿ÐµÑ‡Ð°Ñ‚Ð¾Ðº ÐºÐ»ÑŽÑ‡Ð°.
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.15em', padding: '16px', background: 'var(--panel-2)', borderRadius: '8px', textAlign: 'center', wordBreak: 'break-all' }}>
              {(() => {
                const otherId = chatInfoRef.current?.members?.find((id: string) => id !== currentUser.id);
                const raw = chatId && otherId ? [chatId, otherId].sort().join('') : '';
                const hash = raw ? Array.from(raw).reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0) | 0, 0).toString(16).toUpperCase().slice(-12) : 'â€”';
                const fp = hash !== 'â€”' ? (hash.match(/.{1,4}/g) || [hash]).join(' ') : 'â€”';
                return fp;
              })()}
            </div>
            <button type="button" onClick={() => setShowVerificationModal(false)} style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ</button>
          </div>
        </div>
      )}

      {/* ÐœÐ¾Ð´Ð°Ð»ÑŒÐ½Ð¾Ðµ Ð¾ÐºÐ½Ð¾ Ð¿ÐµÑ€ÐµÑÑ‹Ð»ÐºÐ¸ */}
      {showForwardModal && forwardMessageId && (
        <div className="modal-overlay" onClick={() => setShowForwardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3>ÐŸÐµÑ€ÐµÑÐ»Ð°Ñ‚ÑŒ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ</h3>
              <button onClick={() => setShowForwardModal(false)}>âœ•</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  ÐšÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¹ (Ð½ÐµÐ¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÐ½Ð¾):
                </label>
                <textarea
                  value={forwardComment}
                  onChange={(e) => setForwardComment(e.target.value)}
                  placeholder="Ð”Ð¾Ð±Ð°Ð²ÑŒÑ‚Ðµ ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¹..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #333)',
                    background: 'var(--bg-secondary, #1a1a1a)',
                    color: 'var(--text, #fff)',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Ð’Ñ‹Ð±ÐµÑ€Ð¸Ñ‚Ðµ Ñ‡Ð°Ñ‚:
                </label>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {availableChats.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--subtle, #888)' }}>
                      ÐÐµÑ‚ Ð´Ð¾ÑÑ‚ÑƒÐ¿Ð½Ñ‹Ñ… Ñ‡Ð°Ñ‚Ð¾Ð²
                    </div>
                  ) : (
                    availableChats.map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => forwardMessage(chat.id)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          marginBottom: '8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border, #333)',
                          background: 'var(--bg-secondary, #1a1a1a)',
                          color: 'var(--text, #fff)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-hover, #2a2a2a)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary, #1a1a1a)';
                        }}
                      >
                        <div style={{ fontWeight: '600' }}>{chat.name || (chat.type === 'dm' ? 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ' : 'Ð§Ð°Ñ‚')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--subtle, #888)', marginTop: '4px' }}>
                          {chat.type === 'dm' ? 'Ð”Ð¸Ð°Ð»Ð¾Ð³' : chat.type === 'group' ? 'Ð“Ñ€ÑƒÐ¿Ð¿Ð°' : 'ÐšÐ°Ð½Ð°Ð»'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowForwardModal(false)}>ÐžÑ‚Ð¼ÐµÐ½Ð°</button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-input-container">
        {isRecording && (
          <div className="recording-indicator" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'rgba(220, 53, 69, 0.1)',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <div className="recording-dot" style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#dc3545',
              animation: 'pulse 1s infinite'
            }}></div>
            <span style={{ fontWeight: '600', color: '#dc3545' }}>
              {formatRecordingTime(recordingTime)}
            </span>
            <button 
              onClick={stopRecording}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              âœ“ ÐžÑ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ
            </button>
            <button 
              onClick={cancelRecording}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              âœ• ÐžÑ‚Ð¼ÐµÐ½Ð°
            </button>
          </div>
        )}
        <div className="chat-input-wrapper">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="attach-btn"
              onClick={() => document.getElementById('file-input')?.click()}
              title={`ÐŸÑ€Ð¸ÐºÑ€ÐµÐ¿Ð¸Ñ‚ÑŒ Ñ„Ð°Ð¹Ð» (Ð¼Ð°ÐºÑ. ${MAX_ATTACHMENT_MB} ÐœÐ‘)`}
              onMouseEnter={(e) => {
                const menu = e.currentTarget.nextElementSibling as HTMLElement;
                if (menu) menu.style.display = 'flex';
              }}
            >
              ðŸ“Ž
            </button>
            <div 
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: '8px',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                display: 'none',
                flexDirection: 'column',
                gap: '4px',
                minWidth: '180px',
                zIndex: 1000
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            >
              <button
                onClick={() => {
                  document.getElementById('file-input')?.click();
                }}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                ðŸ“Ž Ð¤Ð°Ð¹Ð»
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) sendFile(file);
                  };
                  input.click();
                }}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                ðŸ–¼ï¸ Ð˜Ð·Ð¾Ð±Ñ€Ð°Ð¶ÐµÐ½Ð¸Ðµ
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) sendDocument(file);
                  };
                  input.click();
                }}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                ðŸ“„ Ð”Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
              <button
                onClick={() => setShowPollCreator(true)}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                ðŸ“Š ÐžÐ¿Ñ€Ð¾Ñ
              </button>
              <button
                onClick={() => setShowCalendarCreator(true)}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                ðŸ“… Ð¡Ð¾Ð±Ñ‹Ñ‚Ð¸Ðµ
              </button>
              <button
                onClick={() => setShowContactCreator(true)}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                ðŸ‘¤ ÐšÐ¾Ð½Ñ‚Ð°ÐºÑ‚
              </button>
            </div>
          </div>
          <button
            className="preview-btn"
            onClick={() => {
              setPreviewText(text);
              setPreviewAttachment(undefined);
              setShowMessagePreview(true);
            }}
            title="ÐŸÑ€ÐµÐ´Ð¿Ñ€Ð¾ÑÐ¼Ð¾Ñ‚Ñ€"
            disabled={!text.trim()}
            style={{
              opacity: text.trim() ? 1 : 0.5,
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              padding: '8px',
              borderRadius: '8px',
              marginRight: '4px'
            }}
          >
            ðŸ‘ï¸
          </button>
          <button
            className="emoji-btn"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowStickerPicker(false);
              setShowGifPicker(false);
              setShowLocationPicker(false);
            }}
            title="Ð­Ð¼Ð¾Ð´Ð·Ð¸"
          >
            ðŸ˜€
          </button>
          <button
            className="sticker-btn"
            onClick={() => {
              setShowStickerPicker(!showStickerPicker);
              setShowEmojiPicker(false);
              setShowGifPicker(false);
              setShowLocationPicker(false);
            }}
            title="Ð¡Ñ‚Ð¸ÐºÐµÑ€Ñ‹"
          >
            ðŸŽ¨
          </button>
          <button
            className="gif-btn"
            onClick={() => {
              setShowGifPicker(!showGifPicker);
              setShowEmojiPicker(false);
              setShowStickerPicker(false);
              setShowLocationPicker(false);
            }}
            title="GIF"
          >
            ðŸŽ¬
          </button>
          <button
            className="location-btn"
            onClick={() => {
              setShowLocationPicker(!showLocationPicker);
              setShowEmojiPicker(false);
              setShowStickerPicker(false);
              setShowGifPicker(false);
              setShowExpirePicker(false);
            }}
            title="Ð“ÐµÐ¾Ð»Ð¾ÐºÐ°Ñ†Ð¸Ñ"
          >
            ðŸ“
          </button>
          <button
            className="expire-btn"
            onClick={() => {
              setShowExpirePicker(!showExpirePicker);
              setShowEmojiPicker(false);
              setShowStickerPicker(false);
              setShowGifPicker(false);
              setShowLocationPicker(false);
            }}
            title="Ð¡Ð°Ð¼Ð¾ÑƒÐ½Ð¸Ñ‡Ñ‚Ð¾Ð¶Ð°ÑŽÑ‰ÐµÐµÑÑ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ"
            style={{
              background: selectedExpireTime ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              border: selectedExpireTime ? '1px solid rgba(239, 68, 68, 0.3)' : 'none'
            }}
          >
            â±ï¸ {selectedExpireTime ? `${selectedExpireTime}Ñ` : ''}
          </button>
          {showExpirePicker && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              minWidth: '200px',
              zIndex: 1000
            }}>
              <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>Ð’Ñ€ÐµÐ¼Ñ Ð¶Ð¸Ð·Ð½Ð¸ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ:</div>
              {[5, 10, 30, 60, 300, 3600].map(seconds => (
                <button
                  key={seconds}
                  onClick={() => {
                    setSelectedExpireTime(seconds);
                    setShowExpirePicker(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginBottom: '4px',
                    background: selectedExpireTime === seconds ? 'var(--accent-primary)' : 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: selectedExpireTime === seconds ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {seconds < 60 ? `${seconds} ÑÐµÐºÑƒÐ½Ð´` : seconds < 3600 ? `${seconds / 60} Ð¼Ð¸Ð½ÑƒÑ‚` : `${seconds / 3600} Ñ‡Ð°ÑÐ¾Ð²`}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedExpireTime(null);
                  setShowExpirePicker(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ÐžÑ‚ÐºÐ»ÑŽÑ‡Ð¸Ñ‚ÑŒ
              </button>
            </div>
          )}
          <div style={{ position: 'relative', flex: 1 }}>
            <textarea
              ref={inputRef}
              className="chat-input"
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onClick={handleInputClick}
              onSelect={handleInputSelectionChange}
              placeholder="ÐÐ°Ð¿Ð¸ÑˆÐ¸Ñ‚Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ... (Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐ¹Ñ‚Ðµ @ Ð´Ð»Ñ ÑƒÐ¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ð¹)"
              rows={1}
            />
            {mentionQuery && (
              <MentionAutocomplete
                text={text}
                cursorPosition={cursorPosition}
                onSelect={handleMentionSelect}
                onClose={() => setMentionQuery(null)}
                chatMembers={chatMembers || chatInfoRef.current?.members}
              />
            )}
            {showEmojiPicker && (
              <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px' }}>
                <EmojiPicker
                  onSelect={(emoji) => {
                    setText(prev => prev + emoji);
                    setShowEmojiPicker(false);
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
            {showStickerPicker && (
              <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px' }}>
                <StickerPicker
                  onSelect={(stickerId) => {
                    sendMessage('', undefined, stickerId);
                    setShowStickerPicker(false);
                  }}
                  onClose={() => setShowStickerPicker(false)}
                />
              </div>
            )}
            {showGifPicker && (
              <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px' }}>
                <GifPicker
                  onSelect={(gifUrl) => {
                    sendMessage('', gifUrl);
                    setShowGifPicker(false);
                  }}
                  onClose={() => setShowGifPicker(false)}
                />
              </div>
            )}
            {showLocationPicker && (
              <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px' }}>
                <LocationPicker
                  onSelect={sendLocation}
                  onClose={() => setShowLocationPicker(false)}
                />
              </div>
            )}
          </div>
          {isRecording ? (
            <button className="record-btn active" onClick={stopRecording}>
              â¹
            </button>
          ) : (
            <button
              className="record-btn"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              title="Ð“Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ (ÑƒÐ´ÐµÑ€Ð¶Ð¸Ð²Ð°Ð¹Ñ‚Ðµ)"
            >
              ðŸŽ¤
            </button>
          )}
          {canUndo && lastSentMessage && (
            <button
              className="undo-btn"
              onClick={undoSendMessage}
              style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                marginRight: '8px',
                transition: 'var(--transition-base)'
              }}
              title="ÐžÑ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÑƒ (Ð´Ð¾ 5 ÑÐµÐº)"
            >
              â†¶ ÐžÑ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ
            </button>
          )}
          <button 
            className="send-btn ripple" 
            onClick={() => {
              const expiresMs = selectedExpireTime ? selectedExpireTime * 1000 : undefined;
              sendMessage(text, undefined, undefined, expiresMs);
              setSelectedExpireTime(null);
            }} 
            disabled={!text.trim() || isLoading}
            title="ÐžÑ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ (Enter)"
          >
            {isLoading ? (
              <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
            ) : (
              'âž¤'
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) sendFile(e.target.files[0]);
          }}
        />
      </div>
    </div>
  );
}
