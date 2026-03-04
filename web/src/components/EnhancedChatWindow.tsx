
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

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
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
  isRead?: boolean; // Прочитано ли сообщение текущим пользователем
  readReceipts?: Array<{ // Список пользователей, прочитавших сообщение
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

// Функция для воспроизведения звука сообщения
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

// Функция для воспроизведения звука звонка
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
  const incomingCallTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { ui, maintenance } = useStore();

  // Загрузка настроек уведомлений
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

  // Отслеживание видимости страницы
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Загрузка пользователей
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

  // Загрузка информации о чате
  // Инициализация группового E2EE ключа
  const initializeGroupE2EE = useCallback(async () => {
    if (!chatId || !chatInfoRef.current) return;
    if (chatInfoRef.current.type !== 'group' && chatInfoRef.current.type !== 'channel') return;
    
    try {
      // Проверяем версию ключа
      const versionData = await api(`/api/chats/${chatId}/group-key/version`);
      const serverVersion = versionData.keyVersion || 0;
      
      if (serverVersion === 0) {
        // Ключа нет - нужно инициализировать (только для owner/admin)
        const chatData = await api(`/api/chats/${chatId}`);
        const isOwnerOrAdmin = chatData.members?.find((m: any) => 
          m.userId === currentUser.id && (m.role === 'owner' || m.role === 'admin')
        );
        
        if (!isOwnerOrAdmin) {
          setIsE2EEEnabled(false);
          return; // Не owner/admin - не можем инициализировать
        }
        
        // Генерируем групповой ключ
        const newGroupKey = await generateGroupKey();
        
        // Получаем публичные ключи всех участников
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
        
        // Отправляем на сервер
        await api(`/api/chats/${chatId}/group-key/init`, 'POST', { wrappedKeys });
        setGroupKey(newGroupKey);
        setGroupKeyVersion(1);
        setIsE2EEEnabled(true);
        showToast('E2EE для группы инициализирован', 'success');
      } else {
        // Ключ существует - загружаем его
        await loadGroupKey();
      }
    } catch (e: any) {
      console.error('Failed to initialize group E2EE:', e);
      setIsE2EEEnabled(false);
    }
  }, [chatId, currentUser.id]);

  // Загрузка группового ключа
  const loadGroupKey = useCallback(async () => {
    if (!chatId) return;
    
    try {
      const keyData = await api(`/api/chats/${chatId}/group-key`);
      if (keyData.wrappedKey) {
        const createdBy = keyData.createdBy != null ? String(keyData.createdBy) : '';
        if (!createdBy) return;
        const creatorKey = await api(`/api/users/${createdBy}/public_key`);
        if (creatorKey.publicKeyJwk) {
          const unwrappedKey = await unwrapKeyFromEnvelope(keyData.wrappedKey, creatorKey.publicKeyJwk, chatId);
          setGroupKey(unwrappedKey);
          setGroupKeyVersion(keyData.keyVersion || 0);
          setIsE2EEEnabled(true);
        }
      }
    } catch (e: any) {
      if (e.message?.includes('key_not_found')) {
        // Ключа нет - попробуем инициализировать
        await initializeGroupE2EE();
      } else {
        console.error('Failed to load group key:', e);
        setIsE2EEEnabled(false);
      }
    }
  }, [chatId, initializeGroupE2EE]);

  // Обновление группового ключа (при изменении состава)
  const updateGroupKey = useCallback(async () => {
    if (!chatId || !chatInfoRef.current) return;
    
    try {
      const newGroupKey = await generateGroupKey();
      
      // Получаем публичные ключи всех участников
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
      showToast('Групповой ключ обновлён (forward secrecy)', 'success');
    } catch (e: any) {
      console.error('Failed to update group key:', e);
      showToast(getErrorMessage(e, 'Не удалось обновить ключ шифрования.'), 'error');
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
        
        // Проверяем права пользователя
        if (chat.members && Array.isArray(chat.members)) {
          const currentMember = chat.members.find((m: any) => m.userId === currentUser.id);
          setIsChatOwner(currentMember?.role === 'owner');
        }
        
        // Проверяем, является ли пользователь админом платформы
        const userRoles = Array.isArray(currentUser.roles) ? currentUser.roles : 
                         (currentUser.roles ? String(currentUser.roles).split(',').map((r: string) => r.trim()) : []);
        setIsPlatformAdmin(userRoles.includes('admin') || userRoles.includes('owner'));
      }
    } catch (e) {
      console.error('Failed to load chat info:', e);
    }
  }, [chatId, currentUser?.id, currentUser?.roles]);

  // Загрузка сообщений с пагинацией
  const loadMessages = useCallback(async (beforeId?: string, append: boolean = false) => {
    if (!chatId) return;
    const url = selectedThreadId 
      ? `/api/threads/${selectedThreadId}/messages`
      : `/api/chats/${chatId}/messages`;
    
    try {
      // Добавляем параметры пагинации
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
        // Добавляем старые сообщения в начало, удаляя дубликаты
        setMessages(prev => {
          const combined = [...loadedMessages, ...prev];
          // Удаляем дубликаты по ID
          const uniqueMessages = combined.filter((message, index, self) =>
            index === self.findIndex((m) => m.id === message.id)
          );
          return uniqueMessages;
        });
        
        // Сохраняем позицию прокрутки
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
        // Заменяем все сообщения (первая загрузка), удаляя возможные дубликаты
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
      
      // Обновляем состояние пагинации
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

  // Загрузка старых сообщений
  const loadMoreMessages = useCallback(async () => {
    if (loadingMoreMessages || !hasMoreMessages || !oldestMessageId) return;
    
    setLoadingMoreMessages(true);
    try {
      await loadMessages(oldestMessageId, true);
    } finally {
      setLoadingMoreMessages(false);
    }
  }, [loadMessages, loadingMoreMessages, hasMoreMessages, oldestMessageId]);

  // Подтягивание новых сообщений по таймеру (fallback, если WebSocket не доставил)
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

  // Обработка прокрутки для автоматической загрузки
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

  // Отметить чат как прочитанный
  const markChatAsRead = useCallback(async () => {
    if (!chatId) return;
    try {
      await api(`/api/chats/${chatId}/read`, 'POST');
    } catch (e) {
      // Игнорируем ошибки, это не критично
    }
  }, [chatId]);
  
  // Отмечаем чат как прочитанный после загрузки сообщений
  useEffect(() => {
    if (messages.length > 0 && chatId) {
      markChatAsRead();
      // Вызываем callback для обновления счетчика в родительском компоненте
      if (onMarkAsRead) {
        onMarkAsRead();
      }
    }
  }, [messages.length, chatId, markChatAsRead, onMarkAsRead]);

  // Загрузка закрепленных сообщений
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

  // Загрузка наборов стикеров
  const loadStickerPacks = useCallback(async () => {
    try {
      const data = await api('/api/sticker-packs');
      const packs = data.packs || [];
      setStickerPacks(packs);
      
      // Загружаем стикеры из всех наборов для быстрого доступа
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

  // Загрузка тредов
  const loadThreads = useCallback(async () => {
    try {
      const data = await api(`/api/chats/${chatId}/threads`);
      // Преобразуем формат данных тредов
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

  // Применение фона и цвета чата
  useEffect(() => {
    if (!chatId) return;
    
    const chatBg = getChatBackground(chatId);
    const chatColor = getChatColor(chatId);
    
    // Используем ref для контейнера чата
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
      // Инициализируем E2EE для групп после загрузки информации о чате
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
          
          // Бэкенд отправляет {"type": "message", "data": {...}}
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
              attachmentUrl: messageData.attachmentUrl || messageData.attachment_url,
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
                const senderName = sender?.username || 'Неизвестный';
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
                  msg.text || (msg.attachmentUrl ? '📎 Вложение' : 'Сообщение'),
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
            // Входящий звонок
            const offerData = data.data || data;
            const fromUserId = offerData.from || data.from;
            const msgChatId = offerData.chatId || data.chatId;
            
            if (msgChatId === chatId && fromUserId && chatInfoRef.current?.type === 'dm' && !inDMCall) {
              const isVideo = offerData.video !== false; // По умолчанию видео, если не указано
              
              // Показываем уведомление о звонке
              if (ui.notificationsEnabled && notificationSettings.desktopEnabled) {
                const caller = users.get(fromUserId);
                const callerName = caller?.username || 'Неизвестный';
                
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
              // Сохраняем время начала входящего звонка для возможного сохранения как пропущенного
              const incomingCallStartTime = Date.now();
              const callKey = `${chatId}-${fromUserId}`;
              
              // Очищаем предыдущий таймер если есть
              const existingTimer = incomingCallTimerRef.current.get(callKey);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }
              
              const confirmed = window.confirm(`Входящий ${isVideo ? 'видео' : ''}звонок от ${users.get(fromUserId)?.username || 'Пользователь'}. Принять?`);
              if (confirmed) {
                setInDMCall({ 
                  isVideo, 
                  otherUserId: fromUserId,
                  isIncoming: true,
                  offerData: offerData
                });
                // Очищаем таймер, так как звонок принят
                incomingCallTimerRef.current.delete(callKey);
              } else {
                // Отклоняем звонок и сохраняем как пропущенный
                sendOptimized('webrtc:hangup', {
                  chatId,
                  to: fromUserId,
                });
                // Сохраняем как пропущенный
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
              
              // Если пользователь не ответит в течение 30 секунд, сохраняем как пропущенный
              const timer = setTimeout(() => {
                // Проверяем, что звонок все еще входящий и не был принят
                if (!inDMCall || inDMCall.otherUserId !== fromUserId || !inDMCall.isIncoming) {
                  // Звонок не был принят - сохраняем как пропущенный
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
            // Звонок завершен
            const hangupData = data.data || data;
            const fromUserId = hangupData.from || data.from;
            if (fromUserId && inDMCall && inDMCall.otherUserId === fromUserId) {
              setInDMCall(null);
              showToast('Звонок завершен', 'info');
            }
              } else if (msgType === 'message:pinned') {
                // Сообщение закреплено
                const pinData = data.data || data;
                const msgChatId = pinData.chatId || data.chatId;
                if (msgChatId !== chatId) return;
                
                // Перезагружаем закрепленные сообщения
                loadPinnedMessages();
                showToast('Сообщение закреплено', 'info');
              } else if (msgType === 'message:unpinned') {
                // Сообщение откреплено
                const unpinData = data.data || data;
                const msgChatId = unpinData.chatId || data.chatId;
                if (msgChatId !== chatId) return;
                
                // Перезагружаем закрепленные сообщения
                loadPinnedMessages();
                showToast('Сообщение откреплено', 'info');
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
                // Обновление статуса прочтения
                const readData = data.data || data;
                const msgChatId = readData.chatId || data.chatId;
                if (msgChatId !== chatId) return;
                
                const messageId = readData.messageId || data.messageId;
                const userId = readData.userId || data.userId;
                const readAt = readData.readAt ? (typeof readData.readAt === 'string' ? new Date(readData.readAt).getTime() : readData.readAt) : Date.now();
                
                if (messageId) {
                  // Обновляем конкретное сообщение
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
                  // Обновляем все сообщения от текущего пользователя в чате
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

      // Проверка истекших сообщений каждую минуту
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

  // Опрос новых сообщений каждые 4 с (fallback, если WebSocket не доставил)
  useEffect(() => {
    if (!chatId || selectedThreadId) return;
    const t = setInterval(pollNewMessages, 4000);
    return () => clearInterval(t);
  }, [chatId, selectedThreadId, pollNewMessages]);

  // Автоскролл при новых сообщениях (мгновенно)
  useEffect(() => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      setShowScrollToBottom(false);
    });
  }, [messages]);

  // Автосохранение черновиков
  useEffect(() => {
    if (text.trim() && chatId) {
      const draftKey = `draft_${chatId}`;
      localStorage.setItem(draftKey, text);
    }
  }, [text, chatId]);

  // Загрузка черновика при открытии чата
  useEffect(() => {
    if (chatId) {
      const draftKey = `draft_${chatId}`;
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        setText(draft);
      }
    }
  }, [chatId]);

  // Отмена отправки сообщения
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
      showToast('Сообщение отменено', 'success');
    } catch (e: any) {
      showToast('Не удалось отменить отправку', 'error');
    }
  };

  // Обработка офлайн очереди при восстановлении связи
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      if (online && chatId) {
        // Синхронизируем очередь при восстановлении связи
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
              // Удаляем из очереди после успешной отправки
              removeFromOfflineQueue(message.id);
            } catch (e) {
              console.error('Failed to sync message:', e);
              // Сообщение останется в очереди для повторной попытки
            }
          }
        }).catch(e => console.error('Failed to sync offline queue:', e));
      }
    });

    return unsubscribe;
  }, [chatId]);

  // Отправка сообщения
  const sendMessage = async (messageText?: string, attachmentUrl?: string, stickerId?: string, expiresMs?: number, threadId?: string) => {
    // Проверяем, что есть хотя бы текст, вложение или стикер
    const finalText = messageText !== undefined ? messageText : text.trim();
    if (!finalText && !attachmentUrl && !stickerId) return;

    try {
      const payload: any = {
        text: finalText || null,
        attachmentUrl: attachmentUrl || null,
        replyTo: replyingTo?.id || null,
        stickerId: stickerId || null,
        expiresMs: expiresMs || null
      };
      
      // Шифруем текст для групп с E2EE
      if (isE2EEEnabled && groupKey && finalText && (chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel')) {
        try {
          const ciphertext = await encryptPlaintext(groupKey, finalText);
          payload.ciphertext = ciphertext;
          payload.text = null; // Не отправляем открытый текст
        } catch (e) {
          console.error('Failed to encrypt message:', e);
          showToast('Ошибка шифрования сообщения', 'error');
          return;
        }
      }
      
      if (selectedThreadId || threadId) {
        payload.threadId = threadId || selectedThreadId;
      }
      // Оптимистичное обновление - добавляем сообщение сразу
      const tempId = 'temp-' + Date.now();
      const optimisticMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.id,
        text: finalText || '',
        uploadProgress: 0,
        attachmentUrl: attachmentUrl || undefined,
        replyTo: replyingTo?.id || undefined,
        stickerId: stickerId || undefined,
        createdAt: Date.now(),
        ...(expiresMs ? { expiresAt: Date.now() + expiresMs } : {}),
      };
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Добавляем класс для анимации отправки
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${tempId}"]`);
        if (messageElement) {
          messageElement.classList.add('sending');
        }
      }, 0);
      
      try {
        // Проверяем онлайн статус
        if (!isOnline()) {
          // Добавляем в офлайн очередь
          const queueId = addToOfflineQueue({
            chatId,
            text: messageText,
            attachmentUrl,
            replyToId: replyingTo?.id,
            type: attachmentUrl ? 'media' : 'text',
            data: payload
          });
          
          // Показываем оптимистичное сообщение
          const optimisticMessage: Message = {
            id: queueId,
            chatId,
            senderId: currentUser.id,
            text: messageText,
            attachmentUrl,
            replyTo: replyingTo?.id,
            replyToMessage: replyingTo,
            threadId,
            createdAt: Date.now(),
            uploadProgress: 100,
            sending: true
          };
          
          setMessages(prev => [...prev, optimisticMessage]);
          showToast('Сообщение будет отправлено при восстановлении связи', 'info');
          return;
        }

        flushWebSocketBatch();
        const response = await api(`/api/chats/${chatId}/messages`, 'POST', payload);
        const realId = response.id;
        // Заменяем временное сообщение на реальное
        setMessages(prev => prev.map(m => m.id === tempId ? {
          ...m,
          id: realId,
          createdAt: typeof response.createdAt === 'string' ? new Date(response.createdAt).getTime() : (typeof response.createdAt === 'number' ? response.createdAt : Date.now()),
          expiresAt: response.expiresAt ? (typeof response.expiresAt === 'string' ? new Date(response.expiresAt).getTime() : response.expiresAt) : m.expiresAt,
        } : m));
        
        // Убираем класс отправки и добавляем класс получения
        setTimeout(() => {
          const messageElement = document.querySelector(`[data-message-id="${realId}"]`);
          if (messageElement) {
            messageElement.classList.remove('sending');
            messageElement.classList.add('received');
          }
        }, 0);
        
        // Сохраняем для возможности отмены
        setLastSentMessage({ id: realId, timestamp: Date.now() });
        setCanUndo(true);
        setTimeout(() => setCanUndo(false), 5000);
        
        // Очищаем черновик
        if (chatId) {
          localStorage.removeItem(`draft_${chatId}`);
        }
        setText('');
        setReplyingTo(null);
        setEditingMessage(null);
        sendOptimized('typing', { chatId, isTyping: false });
        
        // Удаляем сообщение из офлайн очереди, если оно там было
        if (optimisticMessage.id.startsWith('offline_')) {
          removeFromOfflineQueue(optimisticMessage.id);
        }
      } catch (e: any) {
        // Удаляем временное сообщение при ошибке
        setMessages(prev => prev.filter(m => m.id !== tempId));
        showToast(getErrorMessage(e, 'Не удалось отправить сообщение.'), 'error');
        throw e;
      }
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось отправить сообщение.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Редактирование сообщения
  const editMessage = async (messageId: string, newText: string) => {
    if (!newText.trim()) {
      showToast('Сообщение не может быть пустым', 'warning');
      return;
    }
    try {
      await api(`/api/messages/${messageId}/edit`, 'POST', { text: newText.trim() });
      setEditingMessage(null);
      showToast('Сообщение изменено', 'success');
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось изменить сообщение.'), 'error');
    }
  };

  // Удаление сообщения
  const deleteMessage = async (messageId: string, deleteForAll: boolean = false) => {
    try {
      await api(`/api/messages/${messageId}/delete`, 'POST', { deleteForAll });
      showToast(deleteForAll ? 'Сообщение удалено для всех' : 'Сообщение удалено', 'success');
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось удалить сообщение.'), 'error');
    }
  };

  // Поиск по сообщениям
  const searchMessages = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const data = await api(`/api/messages/search?q=${encodeURIComponent(query)}&chatId=${chatId}`);
      const results = data.messages || [];
      
      // Преобразуем результаты в формат Message
      const formattedResults: Message[] = results.map((msg: any) => ({
        id: msg.id,
        chatId: msg.chatId || msg.chat_id || chatId,
        senderId: msg.senderId || msg.sender_id,
        text: msg.text || '',
        attachmentUrl: msg.attachmentUrl || msg.attachment_url,
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
        showToast(getErrorMessage(e, 'Поиск не выполнен. Попробуйте снова.'), 'error');
      }
    }
  };

  // Отправка геолокации
  const sendLocation = async (lat: number, lng: number, address?: string) => {
    try {
      // Сначала отправляем сообщение с текстом локации
      const locationText = address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const msg = await api(`/api/chats/${chatId}/messages`, 'POST', {
        text: `📍 ${locationText}`
      });
      // Затем прикрепляем координаты
      await api(`/api/messages/${msg.message.id}/location`, 'POST', {
        lat,
        lng,
        address
      });
      showToast('Геолокация отправлена', 'success');
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось отправить геолокацию.'), 'error');
    }
  };

  // Создание треда
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
      showToast('Тред создан', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать обсуждение.'), 'error');
    }
  };

  // Отправка файла с прогрессом и сжатием
  const sendFile = async (file: File, isVoiceMessage: boolean = false) => {
    try {
      let fileToUpload = file;
      
      // Сжимаем изображения если нужно
      if (!isVoiceMessage && file.type.startsWith('image/') && shouldCompressImage(file)) {
        try {
          fileToUpload = await compressImage(file, { maxSizeKB: 500, quality: 0.8 });
          showToast('Изображение сжато', 'info');
        } catch (e) {
          console.warn('Failed to compress image, using original:', e);
        }
      }
      
      const form = new FormData();
      form.append('file', fileToUpload);
      
      // Для голосовых сообщений используем специальное имя поля
      if (isVoiceMessage) {
        form.append('kind', 'voice');
      }
      
      // Создаем временное сообщение с прогрессом
      const tempId = 'temp-upload-' + Date.now();
      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.id,
        text: '',
        attachmentUrl: URL.createObjectURL(fileToUpload),
        uploadProgress: 0,
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, tempMessage]);
      
      const xhr = new XMLHttpRequest();
      
      // Отслеживаем прогресс
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
              throw new Error('Не получен URL вложения');
            }
            
            // Удаляем временное сообщение
            setMessages(prev => prev.filter(m => m.id !== tempId));
            
            // Отправляем сообщение с вложением
            await api(`/api/chats/${chatId}/messages`, 'POST', {
              text: isVoiceMessage ? '' : text.trim() || '', // Для голосовых сообщений без текста
              attachmentUrl: attachmentUrl,
              replyTo: replyingTo?.id || null
            });
            
            if (!isVoiceMessage) {
              setText('');
              setReplyingTo(null);
            }
            
            await loadMessages(undefined, false);
            
            if (!isVoiceMessage) {
              showToast('Файл загружен', 'success');
            }
          } catch (e: any) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            throw e;
          }
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          const errorData = JSON.parse(xhr.responseText || '{}');
          throw new Error(errorData.error || errorData.detail || 'upload_error');
        }
      });
      
      xhr.addEventListener('error', () => {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        showToast('Ошибка отправки файла', 'error');
      });
      
      xhr.open('POST', `${getApiBaseUrl()}/api/chats/${chatId}/attach`);
      xhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('token'));
      xhr.send(form);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось загрузить файл.'), 'error');
    }
  };

  // Создание опроса
  const createPoll = async (question: string, options: string[]) => {
    try {
      const response = await api(`/api/chats/${chatId}/messages`, 'POST', {
        poll: {
          question: question.trim(),
          options: options.filter(opt => opt.trim()).map(opt => ({ text: opt.trim() }))
        }
      });
      await loadMessages(undefined, false);
      showToast('Опрос создан', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать опрос.'), 'error');
    }
  };
  
  // Создание календарного события
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
      showToast('Событие создано', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать событие.'), 'error');
    }
  };
  
  // Отправка контакта
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
      showToast('Контакт отправлен', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось отправить контакт.'), 'error');
    }
  };
  
  // Отправка документа
  const sendDocument = async (file: File) => {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'document');
      
      const response = await fetch(`${getApiBaseUrl()}/api/chats/${chatId}/attach`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        body: form
      });
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки документа');
      }
      
      const data = await response.json();
      const attachmentUrl = data.url || data.attachmentUrl;
      
      await api(`/api/chats/${chatId}/messages`, 'POST', {
        document: {
          name: file.name,
          type: file.type,
          size: file.size,
          previewUrl: attachmentUrl
        },
        attachmentUrl
      });
      
      await loadMessages(undefined, false);
      showToast('Документ отправлен', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось отправить документ.'), 'error');
    }
  };

  // Закрепить сообщение
  const pinMessage = async (messageId: string) => {
    try {
      await api(`/api/messages/${messageId}/pin`, 'POST');
      showToast('Сообщение закреплено', 'success');
      loadPinnedMessages();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось закрепить сообщение.'), 'error');
    }
  };

  // Открепить сообщение
  const unpinMessage = async (messageId: string) => {
    try {
      await api(`/api/messages/${messageId}/unpin`, 'POST');
      showToast('Сообщение откреплено', 'success');
      loadPinnedMessages();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось открепить сообщение.'), 'error');
    }
  };

  // Голосовое сообщение
  const recordingStreamRef = useRef<MediaStream | null>(null);
  
  const startRecording = async () => {
    if (!chatId) {
      showToast('Выберите чат для отправки сообщения', 'warning');
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
        // Останавливаем поток
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach(track => track.stop());
          recordingStreamRef.current = null;
        }
        
        if (chunks.length > 0) {
          try {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            
            // Отправляем файл через sendFile с флагом голосового сообщения
            await sendFile(file, true);
            showToast('Голосовое сообщение отправлено', 'success');
          } catch (e: any) {
            showToast(getErrorMessage(e, 'Не удалось отправить голосовое сообщение.'), 'error');
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
      showToast('Не удалось начать запись: ' + (e.message || 'unknown'), 'error');
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
      // Останавливаем запись
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Останавливаем поток
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
      }
      
      // Останавливаем интервал
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      setRecordingTime(0);
      showToast('Запись отменена', 'info');
    }
  };

  // Реакция
  const addReaction = async (messageId: string, emoji: string) => {
    try {
      await api(`/api/messages/${messageId}/react`, 'POST', { emoji });
      await loadMessages(undefined, false);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось поставить реакцию.'), 'error');
    }
  };

  // Загрузка доступных чатов для пересылки
  const loadAvailableChats = async () => {
    try {
      const data = await api('/api/chats');
      const chats = (data.chats || []).filter((c: any) => c.id !== chatId);
      setAvailableChats(chats.map((c: any) => ({
        id: c.id,
        name: c.name || c.members?.find((m: any) => m.userId !== currentUser.id)?.user?.username || 'Чат',
        type: c.type || 'dm'
      })));
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось загрузить чаты.'), 'error');
    }
  };

  // Пересылка сообщения
  const forwardMessage = async (targetChatId: string) => {
    if (!forwardMessageId) return;
    try {
      const message = messages.find(m => m.id === forwardMessageId);
      if (!message) {
        showToast('Сообщение не найдено', 'error');
        return;
      }
      
      await api(`/api/messages/${forwardMessageId}/forward`, 'POST', {
        targetChatId,
        comment: forwardComment.trim() || undefined
      });
      
      showToast('Сообщение переслано', 'success');
      setShowForwardModal(false);
      setForwardMessageId(null);
      setForwardComment('');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось переслать сообщение.'), 'error');
    }
  };

  // Ввод текста с отслеживанием печати и упоминаний
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    setText(newText);
    setCursorPosition(newCursorPos);
    
    // Проверяем упоминания
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

  // Обработка выбора упоминания
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

  // Отправка по Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery && (e.key === 'Enter' || e.key === 'Tab')) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(text);
    }
  };

  // Обработка клика по текстовому полю
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
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
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
    if (dDay.getTime() === today.getTime()) return 'Сегодня';
    if (dDay.getTime() === yesterday.getTime()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Рендеринг текста сообщения с подсветкой упоминаний и форматированием
  const renderMessageText = (messageText: string) => {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    
    // Улучшенный regex для упоминаний - поддерживает @username и @username@domain
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
          // Проверяем, существует ли пользователь с таким username
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
              title={mentionedUser ? `Профиль ${mentionedUser.username}` : `@${match.content}`}
            >
              @{match.content}
            </span>
          );
          break;
        case 'url':
          // Проверяем, является ли это видео URL
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
            <button type="button" className="chat-back-btn-mobile" onClick={onBack} aria-label="Назад к списку чатов">
              ←
            </button>
          )}
          <div className="chat-title">
            {chatInfoRef.current ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: 0 }}>
                {chatInfoRef.current.type === 'dm' ? (() => {
                  const otherMemberId = chatInfoRef.current.members.find((id: string) => id !== currentUser.id);
                  const otherUser = otherMemberId ? users.get(otherMemberId) : null;
                  const displayName = otherUser?.username || chatInfoRef.current?.name || 'Пользователь';
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
                          {isOnline ? 'онлайн' : 'был(а) недавно'}
                        </span>
                      </div>
                    </>
                  );
                })() : (
                  <>
                    {chatInfoRef.current.type === 'group' ? '👥' : '📢'}
                    <span style={{ fontWeight: '600' }}>{chatInfoRef.current.name || 'Чат'}</span>
                    {isE2EEEnabled && (chatInfoRef.current.type === 'group' || chatInfoRef.current.type === 'channel') && (
                      <span title="End-to-End Encryption активен" style={{ fontSize: '14px', color: '#10b981', marginLeft: '4px' }}>🔒</span>
                    )}
                  </>
                )}
              </div>
            ) : selectedThreadId ? (
            <div className="thread-header">
              <button onClick={() => { setSelectedThreadId(null); setShowThreads(false); }} className="back-btn">
                ← Назад
              </button>
              <span>{threads.find(t => t.id === selectedThreadId)?.name || 'Тред'}</span>
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
                  Ответ на {users.get(replyingTo.senderId)?.username || 'пользователя'}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {replyingTo.text ? (replyingTo.text.length > 50 ? replyingTo.text.slice(0, 50) + '...' : replyingTo.text) : 'Сообщение'}
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
                title="Отменить ответ"
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>
        <div className="chat-header-actions">
          <button
            className="search-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="Поиск"
          >
            🔍
          </button>
          <button
            className="media-gallery-btn"
            onClick={() => setShowMediaGallery(true)}
            title="Медиа галерея"
          >
            📷 Медиа
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="export-btn"
              onClick={() => setShowExportDialog(true)}
              title="Экспорт истории чата"
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
              💾
            </button>
            <button
              onClick={() => setShowStatistics(true)}
              title="Статистика чата"
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
              📊
            </button>
            {(chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && (
              <>
                <button
                  onClick={() => setShowBotManager(true)}
                  title="Боты"
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
                  🤖
                </button>
                <button
                  onClick={() => setShowCalendar(true)}
                  title="Календарь"
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
                  📅
                </button>
                <button
                  onClick={() => setShowTodos(true)}
                  title="Задачи"
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
                  ✅
                </button>
              </>
            )}
          </div>
          {pinnedMessages.length > 0 && (
            <button
              className="pinned-btn"
              onClick={() => setShowPinned(!showPinned)}
              title="Закрепленные сообщения"
            >
              📌 {pinnedMessages.length}
            </button>
          )}
          {(chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && (
            <>
              <button
                className="threads-btn"
                onClick={() => setShowThreads(!showThreads)}
                title="Показать треды"
              >
                💬 Треды {threads.length > 0 && `(${threads.length})`}
              </button>
              <button
                className="settings-btn"
                onClick={() => setShowGroupSettings(true)}
                title={chatInfoRef.current?.type === 'group' ? 'Настройки группы' : 'Настройки канала'}
              >
                ⚙️
              </button>
              <button
                className="call-btn"
                onClick={() => { setGroupCallVoiceOnly(true); setInGroupCall(true); }}
                title="Голосовой чат (без видео)"
              >
                📞 Голосовой
              </button>
              <button
                className="video-call-btn"
                onClick={() => { setGroupCallVoiceOnly(false); setInGroupCall(true); }}
                title="Видеозвонок с демонстрацией экрана"
              >
                📹 Видео / Экран
              </button>
              {(isChatOwner || isPlatformAdmin) && (
                <button
                  className="delete-chat-btn"
                  onClick={async () => {
                    if (!confirm('Вы уверены, что хотите удалить этот чат? Это действие нельзя отменить.')) {
                      return;
                    }
                    try {
                      await api(`/api/chats/${chatId}`, 'DELETE');
                      showToast('Чат удален', 'success');
                      window.location.href = '/app/chats';
                    } catch (e: any) {
                      showToast(getErrorMessage(e, 'Не удалось удалить сообщение.'), 'error');
                    }
                  }}
                  title="Удалить чат"
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
                  🗑️
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
                title="Звонок"
              >
                📞
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
                title="Видеозвонок"
              >
                📹
              </button>
            </>
          )}
          <button
            className="call-history-btn"
            onClick={() => setShowCallHistory(true)}
            title="История звонков"
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
            📞
          </button>
          <button
            className="appearance-btn"
            onClick={() => setShowAppearanceSettings(true)}
            title="Внешний вид чата"
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
            🎨
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
            title={chatInfoRef.current?.type === 'dm' ? 'Профиль' : 'Настройки'}
          >
            {chatInfoRef.current?.type === 'dm' ? '👤' : '⚙️'}
          </button>
          {onClose && <button className="close-btn" onClick={onClose}>✕</button>}
        </div>
      </div>

      {/* Поиск по сообщениям */}
      {showSearch && (
        <div className="message-search">
          <div className="search-header">
            <input
              type="text"
              placeholder="Поиск по сообщениям..."
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
              ✕
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
                  
                  // Выделяем найденный текст
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
                        // Если сообщение не в текущем списке, загружаем сообщения
                        if (!messages.find(m => m.id === result.id)) {
                          await loadMessages(undefined, false);
                        }
                        
                        // Прокрутка к сообщению
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
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>📎 Вложение</span>
                        ) : result.stickerId ? (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>🎨 Стикер</span>
                        ) : result.gifUrl ? (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>🎬 GIF</span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Сообщение без текста</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : searchQuery.trim() && (
                <div className="search-results-empty">
                  Ничего не найдено
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Панель закрепленных сообщений */}
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
              📌 Закрепленные ({pinnedMessages.length})
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
              ✕
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
                Нет закрепленных сообщений
              </div>
            ) : (
              pinnedMessages.map((pinnedMsg) => {
                const pinnedSender = getUser(pinnedMsg.senderId);
                return (
                  <div
                    key={pinnedMsg.id}
                    className="pinned-message-item"
                    onClick={() => {
                      // Прокрутка к сообщению
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
                        <span style={{ fontStyle: 'italic' }}>📎 Вложение</span>
                      ) : pinnedMsg.stickerId ? (
                        <span style={{ fontStyle: 'italic' }}>🎨 Стикер</span>
                      ) : pinnedMsg.gifUrl ? (
                        <span style={{ fontStyle: 'italic' }}>🎬 GIF</span>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>Сообщение без текста</span>
                      )}
                    </div>
                    {(isChatOwner || isPlatformAdmin || pinnedMsg.senderId === currentUser.id) && (
                      <button
                        className="pinned-unpin-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          unpinMessage(pinnedMsg.id);
                        }}
                        title="Открепить"
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
                        📌
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
          <span>⚠️</span>
          <span>{maintenance.message || 'Ведутся технические работы.'}</span>
          {maintenance.timestamp && (
            <span style={{ opacity: 0.8, fontSize: '12px' }}> • {maintenance.timestamp}</span>
          )}
        </div>
      )}

      <div 
        ref={messagesContainerRef}
        className="messages-container chat-messages"
        onScroll={handleScroll}
      >
        {/* Кнопка загрузки старых сообщений */}
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
              {loadingMoreMessages ? '⏳ Загрузка...' : '⬆️ Загрузить старые сообщения'}
            </button>
          </div>
        )}
        {messages.length === 0 && !loadingMoreMessages && (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">💬</div>
            <h3 className="chat-empty-title">Нет сообщений</h3>
            <p className="chat-empty-desc">Напишите первое сообщение или прикрепите файл</p>
            <p className="chat-empty-hint">Двойной клик по сообщению — ответить</p>
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
              className={`message-wrapper message ${isMe ? 'message-me me' : ''} ${msg.expiresAt && msg.expiresAt < Date.now() ? 'expired' : ''} ${msg.senderId === currentUser.id ? 'sending' : 'received'}`}
              style={{ animationDelay: `${idx * 0.03}s` }}
              onDoubleClick={() => !msg.deletedAt && setReplyingTo(msg)}
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
                    💬 Тред: {threads.find(t => t.id === msg.threadId)?.name || 'Тред'}
                  </div>
                )}
                {msg.replyTo && (
                  <div 
                    className="message-reply"
                    onClick={() => {
                      // Прокрутка к исходному сообщению
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
                          return `↩️ Ответ на ${replySender?.username || 'пользователя'}`;
                        }
                        return '↩️ Ответ на сообщение';
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
                          if ('attachmentUrl' in replyMsg && replyMsg.attachmentUrl) return '📎 Вложение';
                          if ('stickerId' in replyMsg && replyMsg.stickerId) return '🎨 Стикер';
                          if ('gifUrl' in replyMsg && replyMsg.gifUrl) return '🎬 GIF';
                        }
                        return 'Сообщение';
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
                    <span>➡️ Переслано</span>
                    {msg.forwardedMessage && (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                        от {msg.forwardedMessage.sender?.username || 'пользователя'}
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
                      {msg.forwardedMessage.sender?.username || 'Пользователь'}
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
                        '📎 Вложение'
                      ) : (
                        'Сообщение'
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
                          Загрузка стикера...
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
                          {/* Превью ссылок */}
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
                  {/* Опрос */}
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
                  {/* Календарное событие */}
                  {msg.calendarEvent && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginTop: '8px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                        📅 {msg.calendarEvent.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        🕐 {new Date(msg.calendarEvent.startTime).toLocaleString('ru-RU')}
                        {msg.calendarEvent.endTime && ` - ${new Date(msg.calendarEvent.endTime).toLocaleString('ru-RU')}`}
                      </div>
                      {msg.calendarEvent.location && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          📍 {msg.calendarEvent.location}
                        </div>
                      )}
                      {msg.calendarEvent.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                          {msg.calendarEvent.description}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Контакт */}
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
                          👤 {msg.contact.name}
                        </div>
                        {msg.contact.phone && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            📞 {msg.contact.phone}
                          </div>
                        )}
                        {msg.contact.email && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ✉️ {msg.contact.email}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Документ */}
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
                      <div style={{ fontSize: '32px' }}>📄</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
                          {msg.document.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {msg.document.type.toUpperCase()} • {(msg.document.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      {msg.document.previewUrl && (
                        <img src={msg.document.previewUrl} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                      )}
                    </div>
                  )}
                  {/* История редактирования */}
                  {msg.editHistory && msg.editHistory.length > 0 && (
                    <details style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: 'var(--text-tertiary)'
                    }}>
                      <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                        История редактирования ({msg.editHistory.length})
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
                  {/* Прогресс отправки */}
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
                        <span>Отправка...</span>
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
                  {msg.attachmentUrl && (
                    <div className="message-attachment">
                      {(() => {
                        // Формируем полный URL для медиафайла
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
                              <AudioPlayer src={attachmentUrl} />
                            </div>
                          );
                        } else {
                          return (
                            <a href={attachmentUrl} target="_blank" rel="noreferrer" download>
                              📎 {msg.attachmentUrl.split('/').pop()}
                            </a>
                          );
                        }
                      })()}
                    </div>
                  )}
                  {msg.text && msg.text.includes('📍') && (
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
                        📍 Показать на карте
                      </button>
                    </div>
                  )}
                  <div className="message-meta">
                    <span>{formatTime(msg.createdAt)}</span>
                    {msg.editedAt && <span className="edited">(изменено)</span>}
                    {isMe && (
                      <span className="read-status" title={(() => {
                        if (msg.readReceipts && msg.readReceipts.length > 0) {
                          const lastRead = msg.readReceipts[msg.readReceipts.length - 1];
                          return `Прочитано ${formatTime(lastRead.readAt)}`;
                        }
                        return 'Не прочитано';
                      })()}>
                        {(() => {
                          // Для DM чатов показываем простой статус
                          if (chatInfoRef.current?.type === 'dm') {
                            if (msg.readReceipts && msg.readReceipts.length > 0) {
                              return '✓✓'; // Прочитано (двойная галочка)
                            }
                            return '✓'; // Доставлено (одна галочка)
                          }
                          // Для групповых чатов показываем количество прочитавших
                          if (msg.readReceipts && msg.readReceipts.length > 0) {
                            return `✓✓ ${msg.readReceipts.length}`;
                          }
                          return '✓';
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
                  <button onClick={() => addReaction(msg.id, '👍')}>👍</button>
                  <button onClick={() => addReaction(msg.id, '❤️')}>❤️</button>
                  <button onClick={() => setReplyingTo(msg)}>Ответить</button>
                  <button onClick={() => {
                    setForwardMessageId(msg.id);
                    loadAvailableChats();
                    setShowForwardModal(true);
                  }} title="Переслать">
                    ➡️ Переслать
                  </button>
                  {savedMessages.has(msg.id) ? (
                    <button onClick={() => setSavedMessages(prev => { const next = new Set(prev); next.delete(msg.id); return next; })} title="Удалить из избранного">
                      ⭐
                    </button>
                  ) : (
                    <button onClick={() => setSavedMessages(prev => new Set(prev).add(msg.id))} title="Сохранить в избранное">
                      ☆
                    </button>
                  )}
                  {(() => {
                    const isPinned = pinnedMessages.some(p => p.id === msg.id);
                    return isPinned ? (
                      <button onClick={() => unpinMessage(msg.id)} title="Открепить">
                        📌
                      </button>
                    ) : (
                      <button onClick={() => pinMessage(msg.id)} title="Закрепить">
                        📌
                      </button>
                    );
                  })()}
                  {msg.senderId === currentUser.id && (
                    <>
                      <button onClick={() => setEditingMessage(msg)} title="Редактировать">
                        ✏️
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ open: true, messageId: msg.id, deleteForAll: true })}
                        title="Удалить для всех"
                      >
                        🗑️
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ open: true, messageId: msg.id, deleteForAll: false })}
                        title="Удалить для меня"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                  {(chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && !msg.threadId && (
                    <button onClick={() => {
                      setThreadRootMessageId(msg.id);
                      setShowThreadModal(true);
                    }} title="Создать тред">
                      💬 Тред
                    </button>
                  )}
                </div>
              </div>
            </div>
            </React.Fragment>
          );
        })}
        {typingUsers.size > 0 && (() => {
          const names = Array.from(typingUsers).map((userId: string) => getUser(userId).username || 'Пользователь');
          const text = names.length === 1
            ? `${names[0]} печатает...`
            : names.length === 2
              ? `${names[0]} и ${names[1]} печатают...`
              : names.length > 2
                ? `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]} печатают...`
                : 'печатают...';
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
          title="Вниз к новым сообщениям"
          aria-label="Прокрутить вниз"
        >
          ↓
        </button>
      )}

      {/* Список тредов */}
      {showThreads && !selectedThreadId && (chatInfoRef.current?.type === 'group' || chatInfoRef.current?.type === 'channel') && (
        <div className="threads-sidebar">
          <div className="threads-header">
            <h4>Треды</h4>
            <button onClick={() => setShowThreads(false)}>✕</button>
          </div>
          <div className="threads-list">
            {threads.length === 0 ? (
              <div className="empty-threads">Нет тредов</div>
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
                    {thread.messageCount || 0} сообщений
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

      {/* Медиа галерея */}
      {showMediaGallery && (
        <div className="media-gallery-overlay">
          <MediaGallery
            chatId={chatId}
            onClose={() => setShowMediaGallery(false)}
          />
        </div>
      )}

      {/* Профиль пользователя */}
      {showUserProfile && (
        <div className="user-profile-overlay">
          <UserProfile
            userId={showUserProfile}
            currentUserId={currentUser.id}
            onClose={() => setShowUserProfile(null)}
          />
        </div>
      )}

      {/* Настройки группы/канала */}
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

      {/* История звонков */}
      {showCallHistory && (
        <CallHistory
          chatId={chatId}
          currentUserId={currentUser.id}
          onClose={() => setShowCallHistory(false)}
        />
      )}

      {/* Настройки внешнего вида */}
      {showAppearanceSettings && (
        <AppearanceSettings
          chatId={chatId}
          onClose={() => setShowAppearanceSettings(false)}
        />
      )}

      {/* Экспорт чата */}
      {showExportDialog && (
        <ExportChatDialog
          chatId={chatId}
          chatName={chatInfoRef.current?.type === 'dm' 
            ? (() => {
                const otherMemberId = chatInfoRef.current?.members?.find((id: string) => id !== currentUser.id);
                const otherUser = otherMemberId ? users.get(otherMemberId) : null;
                return otherUser?.username || chatInfoRef.current?.name || 'Пользователь';
              })()
            : (chatInfoRef.current?.name || 'Чат')}
          messages={messages}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Статистика чата */}
      {showStatistics && (
        <ChatStatistics
          chatId={chatId}
          onClose={() => setShowStatistics(false)}
        />
      )}

      {/* Резервное копирование */}
      {showBackupManager && (
        <BackupManager
          onClose={() => setShowBackupManager(false)}
        />
      )}

      {/* Управление ботами */}
      {showBotManager && (
        <BotManager
          chatId={chatId}
          onClose={() => setShowBotManager(false)}
        />
      )}

      {/* Календарь */}
      {showCalendar && (
        <CalendarIntegration
          chatId={chatId}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Задачи */}
      {showTodos && (
        <TodoIntegration
          chatId={chatId}
          onClose={() => setShowTodos(false)}
        />
      )}

      {/* Модальное окно создания треда */}
      <PromptModal
        isOpen={showThreadModal}
        onClose={() => {
          setShowThreadModal(false);
          setThreadRootMessageId('');
        }}
        onConfirm={createThread}
        title="Создать тред"
        message="Введите название треда (необязательно):"
        placeholder="Название треда"
        defaultValue=""
        confirmText="Создать"
        cancelText="Отмена"
      />

      {/* Модальное окно пересылки */}
      {showForwardModal && forwardMessageId && (
        <div className="modal-overlay" onClick={() => setShowForwardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3>Переслать сообщение</h3>
              <button onClick={() => setShowForwardModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Комментарий (необязательно):
                </label>
                <textarea
                  value={forwardComment}
                  onChange={(e) => setForwardComment(e.target.value)}
                  placeholder="Добавьте комментарий..."
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
                  Выберите чат:
                </label>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {availableChats.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--subtle, #888)' }}>
                      Нет доступных чатов
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
                        <div style={{ fontWeight: '600' }}>{chat.name || (chat.type === 'dm' ? 'Пользователь' : 'Чат')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--subtle, #888)', marginTop: '4px' }}>
                          {chat.type === 'dm' ? 'Диалог' : chat.type === 'group' ? 'Группа' : 'Канал'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowForwardModal(false)}>Отмена</button>
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
              ✓ Отправить
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
              ✕ Отмена
            </button>
          </div>
        )}
        <div className="chat-input-wrapper">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="attach-btn"
              onClick={() => document.getElementById('file-input')?.click()}
              title="Прикрепить файл"
              onMouseEnter={(e) => {
                const menu = e.currentTarget.nextElementSibling as HTMLElement;
                if (menu) menu.style.display = 'flex';
              }}
            >
              📎
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
                📎 Файл
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
                🖼️ Изображение
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
                📄 Документ
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
                📊 Опрос
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
                📅 Событие
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
                👤 Контакт
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
            title="Предпросмотр"
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
            👁️
          </button>
          <button
            className="emoji-btn"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowStickerPicker(false);
              setShowGifPicker(false);
              setShowLocationPicker(false);
            }}
            title="Эмодзи"
          >
            😀
          </button>
          <button
            className="sticker-btn"
            onClick={() => {
              setShowStickerPicker(!showStickerPicker);
              setShowEmojiPicker(false);
              setShowGifPicker(false);
              setShowLocationPicker(false);
            }}
            title="Стикеры"
          >
            🎨
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
            🎬
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
            title="Геолокация"
          >
            📍
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
            title="Самоуничтожающееся сообщение"
            style={{
              background: selectedExpireTime ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              border: selectedExpireTime ? '1px solid rgba(239, 68, 68, 0.3)' : 'none'
            }}
          >
            ⏱️ {selectedExpireTime ? `${selectedExpireTime}с` : ''}
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
              <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>Время жизни сообщения:</div>
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
                  {seconds < 60 ? `${seconds} секунд` : seconds < 3600 ? `${seconds / 60} минут` : `${seconds / 3600} часов`}
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
                Отключить
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
              placeholder="Напишите сообщение... (используйте @ для упоминаний)"
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
              ⏹
            </button>
          ) : (
            <button
              className="record-btn"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              title="Голосовое сообщение (удерживайте)"
            >
              🎤
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
              title="Отменить отправку (до 5 сек)"
            >
              ↶ Отменить
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
            title="Отправить (Enter)"
          >
            {isLoading ? (
              <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
            ) : (
              '➤'
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

