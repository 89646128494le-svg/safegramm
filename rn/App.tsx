import 'react-native-get-random-values';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import {
  AuthUser,
  BillingPlan,
  ChatSummary,
  checkoutPremium,
  createSupportTicket,
  createDm,
  getBillingPlans,
  getChats,
  getMessages,
  getPremiumInfo,
  getSupportTickets,
  getSavedApiBase,
  getCurrentUser,
  loginUser,
  MessageItem,
  normalizeApiBase,
  PremiumInfo,
  registerUser,
  saveApiBase,
  searchUsers,
  sendLoginEmailCode,
  sendMessage,
  STORAGE_KEYS,
  SupportTicket,
  uploadAttachment,
} from './src/lib/mobileApi';
import { decryptForChat, encryptForChat, isLiteCiphertext } from './src/lib/e2eeLite';

type ViewMode = 'auth' | 'chats' | 'chat' | 'settings';
type AuthStep = 'credentials' | 'email' | 'cloudCode';

type UiMessage = MessageItem & {
  fromMe: boolean;
  displayText: string;
  encrypted: boolean;
  displayAttachmentUrl?: string;
};

const TTL_OPTIONS = [
  { label: 'off', value: 0 },
  { label: '5s', value: 5_000 },
  { label: '30s', value: 30_000 },
  { label: '1m', value: 60_000 },
  { label: '1h', value: 3_600_000 },
  { label: '1d', value: 86_400_000 },
  { label: '1w', value: 604_800_000 },
];

const QUICK_TEMPLATES = ['Got it', 'Checking now', 'Call at 18:00?', 'Thanks', 'Need help'];
const SUPPORT_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug' },
  { value: 'account', label: 'Account' },
  { value: 'security', label: 'Security' },
  { value: 'billing', label: 'Billing' },
  { value: 'premium', label: 'Premium' },
  { value: 'idea', label: 'Idea' },
];
const SUPPORT_PRIORITIES = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
  { value: 'low', label: 'Low' },
];
const STARRED_CHATS_KEY = 'sg_starred_chats';
const LEGAL_BASE = 'https://safegram-hazel.vercel.app';
const AUTH_STEPS: Array<{ key: AuthStep; label: string; short: string }> = [
  { key: 'credentials', label: 'Credentials', short: '01' },
  { key: 'email', label: 'Email check', short: '02' },
  { key: 'cloudCode', label: 'Cloud code', short: '03' },
];

function humanDate(value?: string): string {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString();
}

function humanFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(url?: string): boolean {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif|svg)(\?|$)/i.test(url);
}

function getInitials(value?: string): string {
  const source = (value || '').trim();
  if (!source) return 'SG';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function humanRelativeTime(value?: string): string {
  if (!value) return 'just now';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'just now';
  const diffMs = Date.now() - dt.getTime();
  if (diffMs < 60_000) return 'now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)}d ago`;
  return dt.toLocaleDateString();
}

function getAuthStepTone(current: AuthStep, target: AuthStep): 'idle' | 'active' | 'done' {
  const order: Record<AuthStep, number> = {
    credentials: 0,
    email: 1,
    cloudCode: 2,
  };
  if (order[target] < order[current]) return 'done';
  if (current === target) return 'active';
  return 'idle';
}

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.backdrop}>
        <View style={[styles.glowOrb, styles.glowOrbA]} />
        <View style={[styles.glowOrb, styles.glowOrbB]} />
        <View style={[styles.glowOrb, styles.glowOrbC]} />
        <View style={styles.backdropNoise} />
      </View>
      <View style={styles.frame}>{children}</View>
    </SafeAreaView>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<ViewMode>('auth');
  const [apiBase, setApiBase] = useState('https://141.8.198.152.nip.io');
  const [apiInput, setApiInput] = useState('https://141.8.198.152.nip.io');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [premiumInfo, setPremiumInfo] = useState<PremiumInfo | null>(null);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumActionPlanId, setPremiumActionPlanId] = useState('');
  const [secureMode, setSecureMode] = useState(true);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authStep, setAuthStep] = useState<AuthStep>('credentials');
  const [emailCode, setEmailCode] = useState('');
  const [cloudCode, setCloudCode] = useState('');
  const [authHint, setAuthHint] = useState('');
  const [devEmailCode, setDevEmailCode] = useState('');
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authLoading, setAuthLoading] = useState(false);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composer, setComposer] = useState('');
  const [selectedTtl, setSelectedTtl] = useState(0);

  const [searchQ, setSearchQ] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string }>>([]);
  const [chatSearchQ, setChatSearchQ] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [starredChats, setStarredChats] = useState<Set<string>>(new Set());
  const [refreshingChats, setRefreshingChats] = useState(false);
  const [refreshingMessages, setRefreshingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [pickingAttachment, setPickingAttachment] = useState(false);
  const [attachmentDraft, setAttachmentDraft] = useState<{
    uri: string;
    name: string;
    type: string;
    size?: number;
  } | null>(null);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportCategory, setSupportCategory] = useState('general');
  const [supportPriority, setSupportPriority] = useState('normal');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportBody, setSupportBody] = useState('');

  const connectionHost = useMemo(() => {
    try {
      return new URL(apiBase).host;
    } catch {
      return apiBase.replace(/^https?:\/\//i, '');
    }
  }, [apiBase]);

  const selectedTtlLabel = useMemo(
    () => TTL_OPTIONS.find((item) => item.value === selectedTtl)?.label || 'off',
    [selectedTtl]
  );

  const premiumPlanCards = useMemo(
    () => billingPlans.filter((plan) => plan.plan === 'premium'),
    [billingPlans]
  );

  const premiumStatusLine = useMemo(() => {
    if (!premiumInfo) return 'Billing status not loaded yet.';
    if (premiumInfo.isPremium) {
      if (premiumInfo.premiumExpiresAt) {
        return `Active until ${humanDate(premiumInfo.premiumExpiresAt)}`;
      }
      return 'Premium active without expiry limit';
    }
    return 'Free plan active';
  }, [premiumInfo]);

  const authStepMeta = useMemo(() => {
    if (authStep === 'credentials') {
      return {
        eyebrow: 'Mobile access',
        title: 'Secure device sign in',
        text: 'Use ID and password to enter the shared SafeGram backend. Registration still signs you in immediately for smoke testing.',
      };
    }
    if (authStep === 'email') {
      return {
        eyebrow: 'Checkpoint 2 of 3',
        title: 'Confirm your email',
        text: 'This account requires an email verification code before the session token is issued.',
      };
    }
    return {
      eyebrow: 'Checkpoint 3 of 3',
      title: 'Unlock cloud protection',
      text: 'Enter the cloud PIN for this account to restore full access on this device.',
    };
  }, [authStep]);

  const selectedChatTitle = useMemo(() => {
    if (!selectedChat) return '';
    if (selectedChat.name && selectedChat.name.trim()) return selectedChat.name.trim();
    if (selectedChat.type === 'dm' && selectedChat.members && user) {
      for (const member of selectedChat.members) {
        const candidateId = member.user?.id || member.userId;
        if (candidateId && candidateId !== user.id) {
          return member.user?.username || `User ${candidateId.slice(0, 6)}`;
        }
      }
    }
    return `${selectedChat.type.toUpperCase()} ${selectedChat.id.slice(0, 6)}`;
  }, [selectedChat, user]);

  const getChatCardTitle = useCallback(
    (chat: ChatSummary) => {
      if (chat.name && chat.name.trim()) return chat.name.trim();
      if (chat.type === 'dm' && chat.members && user) {
        for (const member of chat.members) {
          const candidateId = member.user?.id || member.userId;
          if (candidateId && candidateId !== user.id) {
            return member.user?.username || `User ${candidateId.slice(0, 6)}`;
          }
        }
      }
      return chat.type === 'dm' ? 'Direct message' : chat.type.toUpperCase();
    },
    [user]
  );

  const getChatCardSubtitle = useCallback((chat: ChatSummary) => {
    if (chat.lastMessage?.text) return chat.lastMessage.text;
    if (chat.lastMessage?.ciphertext) return 'Encrypted message';
    if (chat.lastMessage?.attachmentUrl) return 'Attachment';
    return 'No messages yet';
  }, []);

  const resolveAttachmentUrl = useCallback(
    (raw?: string): string | undefined => {
      if (!raw) return undefined;
      if (/^https?:\/\//i.test(raw)) return raw;
      const normalized = normalizeApiBase(apiBase);
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      return `${normalized}${path}`;
    },
    [apiBase]
  );

  const filteredChats = useMemo(() => {
    const query = chatSearchQ.trim().toLowerCase();
    const list = chats.filter((chat) => {
      if (showStarredOnly && !starredChats.has(chat.id)) return false;
      if (!query) return true;
      const title = getChatCardTitle(chat).toLowerCase();
      const subtitle = getChatCardSubtitle(chat).toLowerCase();
      return title.includes(query) || subtitle.includes(query);
    });

    return [...list].sort((a, b) => {
      const aStar = starredChats.has(a.id) ? 1 : 0;
      const bStar = starredChats.has(b.id) ? 1 : 0;
      if (aStar !== bStar) return bStar - aStar;
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [chatSearchQ, chats, getChatCardSubtitle, getChatCardTitle, showStarredOnly, starredChats]);

  const chatsStats = useMemo(() => {
    const total = chats.length;
    const starred = starredChats.size;
    const dm = chats.filter((item) => item.type === 'dm').length;
    const groups = chats.filter((item) => item.type !== 'dm').length;
    return { total, starred, dm, groups };
  }, [chats, starredChats]);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) return null;
    const current = await getCurrentUser(apiBase, token);
    setUser(current);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(current));
    return current;
  }, [apiBase, token]);

  const loadPremiumState = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!token) {
      setPremiumInfo(null);
      setBillingPlans([]);
      return;
    }
    setPremiumLoading(true);
    try {
      const [info, plans] = await Promise.all([
        getPremiumInfo(apiBase, token),
        getBillingPlans(apiBase),
      ]);
      setPremiumInfo(info);
      setBillingPlans(plans);
      await refreshCurrentUser();
    } catch (error: any) {
      if (!options.silent) {
        Alert.alert('Premium', String(error?.message || error));
      }
    } finally {
      setPremiumLoading(false);
    }
  }, [apiBase, refreshCurrentUser, token]);

  const loadSupportTicketsSafe = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!token) {
      setSupportTickets([]);
      return;
    }
    setSupportLoading(true);
    try {
      const items = await getSupportTickets(apiBase, token);
      setSupportTickets(items);
    } catch (error: any) {
      if (!options.silent) {
        Alert.alert('Support', String(error?.message || error));
      }
    } finally {
      setSupportLoading(false);
    }
  }, [apiBase, token]);

  const hydrateSession = useCallback(async () => {
    const [savedToken, savedUserRaw, savedApiBase, savedSecureMode, savedStarredChats] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.token),
      AsyncStorage.getItem(STORAGE_KEYS.user),
      getSavedApiBase(),
      AsyncStorage.getItem(STORAGE_KEYS.secureMode),
      AsyncStorage.getItem(STARRED_CHATS_KEY),
    ]);

    const normalizedApi = normalizeApiBase(savedApiBase);
    setApiBase(normalizedApi);
    setApiInput(normalizedApi);
    setSecureMode(savedSecureMode !== '0');
    if (savedStarredChats) {
      try {
        const parsed = JSON.parse(savedStarredChats);
        if (Array.isArray(parsed)) setStarredChats(new Set(parsed.filter((v) => typeof v === 'string')));
      } catch {
        // ignore malformed local cache
      }
    }

    if (savedToken && savedUserRaw) {
      try {
        const parsedUser = JSON.parse(savedUserRaw) as AuthUser;
        setToken(savedToken);
        setUser(parsedUser);
        setView('chats');
      } catch {
        await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
      }
    }
    setBooting(false);
  }, []);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!token) {
      setPremiumInfo(null);
      setBillingPlans([]);
      setSupportTickets([]);
      return;
    }
    if (view === 'settings') {
      loadPremiumState({ silent: true });
      loadSupportTicketsSafe({ silent: true });
    }
  }, [loadPremiumState, loadSupportTicketsSafe, token, view]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
    setToken(null);
    setUser(null);
    setPremiumInfo(null);
    setBillingPlans([]);
    setSupportTickets([]);
    setChats([]);
    setSearchResults([]);
    setSelectedChat(null);
    setMessages([]);
    setComposer('');
    setAttachmentDraft(null);
    setChatSearchQ('');
    setShowStarredOnly(false);
    setAuthStep('credentials');
    setEmailCode('');
    setCloudCode('');
    setAuthHint('');
    setDevEmailCode('');
    setResendCooldown(0);
    setSupportSubject('');
    setSupportBody('');
    setSupportCategory('general');
    setSupportPriority('normal');
    setView('auth');
  }, []);

  const resetAuthFlow = useCallback(() => {
    setAuthStep('credentials');
    setEmailCode('');
    setCloudCode('');
    setAuthHint('');
    setDevEmailCode('');
    setResendCooldown(0);
  }, []);

  const completeLogin = useCallback(async (nextToken: string, nextUser: AuthUser) => {
    let hydratedUser = nextUser;
    try {
      hydratedUser = await getCurrentUser(apiBase, nextToken);
    } catch {
      hydratedUser = nextUser;
    }
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.token, nextToken],
      [STORAGE_KEYS.user, JSON.stringify(hydratedUser)],
    ]);
    setToken(nextToken);
    setUser(hydratedUser);
    setPremiumInfo(null);
    setUsername('');
    setPassword('');
    resetAuthFlow();
    setView('chats');
  }, [apiBase, resetAuthFlow]);

  const requestLoginEmailCode = useCallback(async () => {
    const loginName = username.trim();
    if (!loginName) {
      Alert.alert('Validation', 'Enter username first');
      return false;
    }
    if (resendCooldown > 0) {
      return true;
    }

    setSendingEmailCode(true);
    try {
      const result = await sendLoginEmailCode(apiBase, loginName);
      setDevEmailCode(result.code || '');
      setAuthHint(result.code ? 'Enter the code from email or use the dev code below.' : 'Enter the code sent to your email.');
      setResendCooldown(60);
      return true;
    } catch (error: any) {
      Alert.alert('Email code', String(error?.message || error));
      return false;
    } finally {
      setSendingEmailCode(false);
    }
  }, [apiBase, resendCooldown, username]);

  const loadChatsSafe = useCallback(async () => {
    if (!token) return;
    setChatsLoading(true);
    try {
      const list = await getChats(apiBase, token);
      setChats(list);
    } catch (error: any) {
      if ((error?.message || '').includes('session_invalid')) {
        await logout();
        return;
      }
      Alert.alert('Chats error', String(error?.message || error));
    } finally {
      setChatsLoading(false);
    }
  }, [apiBase, logout, token]);

  const mapMessagesToUi = useCallback(
    async (chatId: string, incoming: MessageItem[]): Promise<UiMessage[]> => {
      const mapped = await Promise.all(
        incoming.map(async (item) => {
          let displayText = item.text || '';
          let encrypted = false;

          if (!displayText && item.ciphertext) {
            encrypted = true;
            if (isLiteCiphertext(item.ciphertext)) {
              const decrypted = await decryptForChat(chatId, item.ciphertext);
              displayText = decrypted || 'Encrypted message (unavailable on this device)';
            } else {
              displayText = item.ciphertext;
            }
          }

          if (!displayText) {
            displayText = item.attachmentUrl ? 'Attachment' : '(empty)';
          }

          return {
            ...item,
            fromMe: item.senderId === user?.id,
            displayText,
            encrypted,
            displayAttachmentUrl: resolveAttachmentUrl(item.attachmentUrl),
          };
        })
      );
      return mapped;
    },
    [resolveAttachmentUrl, user?.id]
  );

  const loadMessagesSafe = useCallback(
    async (chatId: string, withSpinner = true) => {
      if (!token) return;
      if (withSpinner) setMessagesLoading(true);
      try {
        const list = await getMessages(apiBase, token, chatId);
        const uiMessages = await mapMessagesToUi(chatId, list);
        setMessages(uiMessages);
      } catch (error: any) {
        Alert.alert('Messages error', String(error?.message || error));
      } finally {
        if (withSpinner) setMessagesLoading(false);
      }
    },
    [apiBase, mapMessagesToUi, token]
  );

  useEffect(() => {
    if (token && view === 'chats') {
      loadChatsSafe();
    }
  }, [token, view, loadChatsSafe]);

  useEffect(() => {
    if (!token || view !== 'chat' || !selectedChat?.id) return;
    const chatId = selectedChat.id;
    loadMessagesSafe(chatId, true);
    const id = setInterval(() => {
      loadMessagesSafe(chatId, false);
    }, 3000);
    return () => clearInterval(id);
  }, [loadMessagesSafe, selectedChat?.id, token, view]);

  const onLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Validation', 'Enter username and password');
      return;
    }
    if (authStep === 'email' && emailCode.trim().length < 4) {
      Alert.alert('Validation', 'Enter email verification code');
      return;
    }
    if (authStep === 'cloudCode' && cloudCode.trim().length < 4) {
      Alert.alert('Validation', 'Enter cloud code');
      return;
    }
    setAuthLoading(true);
    try {
      const auth = await loginUser(apiBase, username.trim(), password, {
        emailCode: authStep === 'credentials' ? undefined : emailCode.trim(),
        cloudCode: authStep === 'cloudCode' ? cloudCode.trim() : undefined,
      });

      if (auth.kind === 'success') {
        await completeLogin(auth.token, auth.user);
        return;
      }

      if (auth.step === 'email') {
        setAuthStep('email');
        setAuthHint(auth.message || 'Email verification is required for this account.');
        const sent = await requestLoginEmailCode();
        if (!sent && !authHint) {
          setAuthHint('Use "Send code" to request a fresh email code.');
        }
        return;
      }

      setAuthStep('cloudCode');
      setAuthHint(auth.message || 'Enter your cloud code to finish login.');
    } catch (error: any) {
      Alert.alert('Login failed', String(error?.message || error));
    } finally {
      setAuthLoading(false);
    }
  }, [apiBase, authHint, authStep, cloudCode, completeLogin, emailCode, password, requestLoginEmailCode, username]);

  const onRegister = useCallback(async () => {
    if (username.trim().length < 3 || password.length < 4) {
      Alert.alert('Validation', 'Username >= 3 and password >= 4');
      return;
    }
    setAuthLoading(true);
    try {
      await registerUser(apiBase, username.trim(), password);
      const auth = await loginUser(apiBase, username.trim(), password);
      if (auth.kind !== 'success') {
        throw new Error('Unexpected login challenge after registration');
      }
      await completeLogin(auth.token, auth.user);
    } catch (error: any) {
      Alert.alert('Register failed', String(error?.message || error));
    } finally {
      setAuthLoading(false);
    }
  }, [apiBase, completeLogin, password, username]);

  const onOpenChat = useCallback(
    async (chat: ChatSummary) => {
      setSelectedChat(chat);
      setMessages([]);
      setComposer('');
      setAttachmentDraft(null);
      setView('chat');
      await loadMessagesSafe(chat.id, true);
    },
    [loadMessagesSafe]
  );

  const onFindUsers = useCallback(async () => {
    if (!token) return;
    if (searchQ.trim().length < 2) {
      Alert.alert('Search', 'Enter at least 2 chars');
      return;
    }
    setSearchLoading(true);
    try {
      const users = await searchUsers(apiBase, token, searchQ.trim());
      setSearchResults(users.filter((item) => item.id !== user?.id));
    } catch (error: any) {
      Alert.alert('Search error', String(error?.message || error));
    } finally {
      setSearchLoading(false);
    }
  }, [apiBase, searchQ, token, user?.id]);

  const onCreateDm = useCallback(
    async (peerUserId: string) => {
      if (!token) return;
      try {
        const created = await createDm(apiBase, token, peerUserId);
        await loadChatsSafe();
        await onOpenChat(created);
      } catch (error: any) {
        Alert.alert('DM create failed', String(error?.message || error));
      }
    },
    [apiBase, loadChatsSafe, onOpenChat, token]
  );

  const onOpenSupportChat = useCallback(
    async (chatId?: string) => {
      if (!token || !chatId) {
        Alert.alert('Support', 'Support chat will appear after the first reply or sync.');
        return;
      }
      try {
        let targetChat = chats.find((chat) => chat.id === chatId) || null;
        if (!targetChat) {
          const refreshed = await getChats(apiBase, token);
          setChats(refreshed);
          targetChat = refreshed.find((chat) => chat.id === chatId) || null;
        }
        if (!targetChat) {
          Alert.alert('Support', 'Support chat not found yet. Refresh chats and try again.');
          return;
        }
        await onOpenChat(targetChat);
      } catch (error: any) {
        Alert.alert('Support', String(error?.message || error));
      }
    },
    [apiBase, chats, onOpenChat, token]
  );

  const onSubmitSupportTicket = useCallback(async () => {
    if (!token) {
      Alert.alert('Support', 'Sign in first');
      return;
    }
    const subject = supportSubject.trim();
    const body = supportBody.trim();
    if (!subject || !body) {
      Alert.alert('Support', 'Enter subject and description');
      return;
    }
    setSupportSubmitting(true);
    try {
      const response = await createSupportTicket(apiBase, token, {
        subject,
        body,
        category: supportCategory,
        priority: supportPriority,
      });
      setSupportSubject('');
      setSupportBody('');
      await Promise.all([
        loadSupportTicketsSafe({ silent: true }),
        loadChatsSafe(),
      ]);
      Alert.alert(
        'Support',
        response.chatId
          ? 'Ticket created. Support replies will arrive in the anonymous support chat.'
          : 'Ticket created.'
      );
      if (response.chatId) {
        await onOpenSupportChat(response.chatId);
      }
    } catch (error: any) {
      Alert.alert('Support', String(error?.message || error));
    } finally {
      setSupportSubmitting(false);
    }
  }, [
    apiBase,
    loadChatsSafe,
    loadSupportTicketsSafe,
    onOpenSupportChat,
    supportBody,
    supportCategory,
    supportPriority,
    supportSubject,
    token,
  ]);

  const onSendMessage = useCallback(async () => {
    if (!token || !selectedChat) return;
    const text = composer.trim();
    if (!text && !attachmentDraft) return;

    setSendingMessage(true);
    try {
      let attachmentUrl: string | undefined;
      if (attachmentDraft) {
        const uploaded = await uploadAttachment(apiBase, token, selectedChat.id, {
          uri: attachmentDraft.uri,
          name: attachmentDraft.name,
          type: attachmentDraft.type,
        });
        attachmentUrl = uploaded.attachmentUrl;
      }

      if (secureMode) {
        const ciphertext = text ? await encryptForChat(selectedChat.id, text) : undefined;
        await sendMessage(apiBase, token, {
          chatId: selectedChat.id,
          ciphertext,
          attachmentUrl,
          expiresMs: selectedTtl || undefined,
        });
      } else {
        await sendMessage(apiBase, token, {
          chatId: selectedChat.id,
          text: text || undefined,
          attachmentUrl,
          expiresMs: selectedTtl || undefined,
        });
      }
      setComposer('');
      setAttachmentDraft(null);
      await loadMessagesSafe(selectedChat.id, false);
    } catch (error: any) {
      Alert.alert('Send failed', String(error?.message || error));
    } finally {
      setSendingMessage(false);
    }
  }, [apiBase, attachmentDraft, composer, loadMessagesSafe, secureMode, selectedChat, selectedTtl, token]);

  const onPickAttachment = useCallback(async () => {
    if (!selectedChat) return;
    setPickingAttachment(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setAttachmentDraft({
        uri: asset.uri,
        name: asset.name || `file_${Date.now()}`,
        type: asset.mimeType || 'application/octet-stream',
        size: typeof asset.size === 'number' ? asset.size : undefined,
      });
    } catch (error: any) {
      Alert.alert('Attachment', String(error?.message || error));
    } finally {
      setPickingAttachment(false);
    }
  }, [selectedChat]);

  const onOpenAttachment = useCallback(async (url?: string) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Attachment', 'Cannot open this file on device');
      return;
    }
    await Linking.openURL(url);
  }, []);

  const onOpenLegal = useCallback(async (path: 'privacy' | 'terms') => {
    const url = `${LEGAL_BASE}/${path}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Open link', url);
      return;
    }
    await Linking.openURL(url);
  }, []);

  const onOpenSupportPage = useCallback(async () => {
    const url = `${LEGAL_BASE}/support`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Support', url);
      return;
    }
    await Linking.openURL(url);
  }, []);

  const onStartPremiumCheckout = useCallback(async (planId: string) => {
    if (!token) {
      Alert.alert('Premium', 'Sign in first');
      return;
    }
    setPremiumActionPlanId(planId);
    try {
      const result = await checkoutPremium(apiBase, token, planId);
      if (result.activated) {
        await loadPremiumState();
        Alert.alert('Premium', 'Premium activated on this account');
        return;
      }
      if (result.checkoutUrl) {
        const supported = await Linking.canOpenURL(result.checkoutUrl);
        if (!supported) {
          Alert.alert('Premium checkout', result.checkoutUrl);
          return;
        }
        await Linking.openURL(result.checkoutUrl);
        return;
      }
      Alert.alert('Premium', 'Checkout created, but no URL returned');
    } catch (error: any) {
      Alert.alert('Premium', String(error?.message || error));
    } finally {
      setPremiumActionPlanId('');
    }
  }, [apiBase, loadPremiumState, token]);

  const onSaveApiBase = useCallback(async () => {
    const normalized = await saveApiBase(apiInput);
    setApiBase(normalized);
    setApiInput(normalized);
    Alert.alert('Saved', `API base: ${normalized}`);
  }, [apiInput]);

  const onToggleSecureMode = useCallback(async (next: boolean) => {
    setSecureMode(next);
    await AsyncStorage.setItem(STORAGE_KEYS.secureMode, next ? '1' : '0');
  }, []);

  const persistStarredChats = useCallback(async (next: Set<string>) => {
    setStarredChats(new Set(next));
    await AsyncStorage.setItem(STARRED_CHATS_KEY, JSON.stringify(Array.from(next)));
  }, []);

  const onToggleStarChat = useCallback(
    async (chatId: string) => {
      const next = new Set(starredChats);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      await persistStarredChats(next);
    },
    [persistStarredChats, starredChats]
  );

  const onRefreshChats = useCallback(async () => {
    if (!token) return;
    setRefreshingChats(true);
    try {
      const list = await getChats(apiBase, token);
      setChats(list);
    } catch (error: any) {
      Alert.alert('Refresh failed', String(error?.message || error));
    } finally {
      setRefreshingChats(false);
    }
  }, [apiBase, token]);

  const onRefreshMessages = useCallback(async () => {
    if (!token || !selectedChat) return;
    setRefreshingMessages(true);
    try {
      const list = await getMessages(apiBase, token, selectedChat.id);
      const uiMessages = await mapMessagesToUi(selectedChat.id, list);
      setMessages(uiMessages);
    } catch (error: any) {
      Alert.alert('Refresh failed', String(error?.message || error));
    } finally {
      setRefreshingMessages(false);
    }
  }, [apiBase, mapMessagesToUi, selectedChat, token]);

  if (booting) {
    return (
      <AppFrame>
        <View style={styles.bootScreen}>
          <View style={styles.bootBadge}>
            <Text style={styles.bootBadgeText}>SG</Text>
          </View>
          <Text style={styles.bootEyebrow}>Encrypted workspace</Text>
          <Text style={styles.bootTitle}>SafeGram</Text>
          <Text style={styles.bootText}>Preparing your device keys, chat cache and secure session state.</Text>
          <ActivityIndicator color="#6fc2ff" size="large" style={{ marginTop: 16 }} />
        </View>
      </AppFrame>
    );
  }

  if (view === 'auth') {
    return (
      <AppFrame>
        <ScrollView contentContainerStyle={styles.authScreenContent} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.heroCard}>
            <Text style={styles.eyebrow}>{authStepMeta.eyebrow}</Text>
            <Text style={styles.heroTitle}>{authStepMeta.title}</Text>
            <Text style={styles.heroText}>{authStepMeta.text}</Text>

            <View style={styles.stepRow}>
              {AUTH_STEPS.map((step) => {
                const tone = getAuthStepTone(authStep, step.key);
                return (
                  <View
                    key={step.key}
                    style={[
                      styles.stepChip,
                      tone === 'active' ? styles.stepChipActive : null,
                      tone === 'done' ? styles.stepChipDone : null,
                    ]}
                  >
                    <Text style={styles.stepChipNumber}>{step.short}</Text>
                    <Text style={styles.stepChipLabel}>{step.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.heroMetricRow}>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricValue}>DM</Text>
                <Text style={styles.heroMetricLabel}>Direct encrypted chats</Text>
              </View>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricValue}>TTL</Text>
                <Text style={styles.heroMetricLabel}>Expiring message presets</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard>
            <View style={styles.sectionHeaderInline}>
              <View>
                <Text style={styles.sectionTitle}>Connection</Text>
                <Text style={styles.sectionSubtitle}>Shared backend for mobile, web and desktop.</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{connectionHost}</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>API base</Text>
            <TextInput
              value={apiInput}
              onChangeText={setApiInput}
              autoCapitalize="none"
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor="#6f7e99"
            />
            <Pressable style={styles.secondaryButton} onPress={onSaveApiBase}>
              <Text style={styles.secondaryButtonText}>Save endpoint</Text>
            </Pressable>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Account access</Text>
            <Text style={styles.sectionSubtitle}>Tonight build keeps auth simple, but the flow supports email and cloud-code challenges.</Text>

            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                if (authStep !== 'credentials') resetAuthFlow();
              }}
              autoCapitalize="none"
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#6f7e99"
              editable={!authLoading}
            />

            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (authStep !== 'credentials') resetAuthFlow();
              }}
              secureTextEntry
              style={styles.input}
              placeholder="password"
              placeholderTextColor="#6f7e99"
              editable={!authLoading}
            />

            {authStep === 'email' ? (
              <View style={styles.challengeCard}>
                <Text style={styles.challengeTitle}>Email verification</Text>
                <Text style={styles.challengeText}>{authHint || 'A login code is required for this account.'}</Text>
                <TextInput
                  value={emailCode}
                  onChangeText={(value) => setEmailCode(value.replace(/\D/g, '').slice(0, 6))}
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  style={styles.input}
                  placeholder="6-digit code"
                  placeholderTextColor="#6f7e99"
                  editable={!authLoading}
                />
                {devEmailCode ? <Text style={styles.devCode}>Dev code: {devEmailCode}</Text> : null}
              </View>
            ) : null}

            {authStep === 'cloudCode' ? (
              <View style={styles.challengeCard}>
                <Text style={styles.challengeTitle}>Cloud code</Text>
                <Text style={styles.challengeText}>{authHint || 'Enter the cloud code configured for this account.'}</Text>
                <TextInput
                  value={cloudCode}
                  onChangeText={setCloudCode}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
                  placeholder="PIN / cloud code"
                  placeholderTextColor="#6f7e99"
                  editable={!authLoading}
                />
              </View>
            ) : null}

            <View style={styles.primaryActionsRow}>
              <Pressable style={styles.primaryButton} onPress={onLogin}>
                <Text style={styles.primaryButtonText}>
                  {authStep === 'credentials' ? 'Sign in' : authStep === 'email' ? 'Verify code' : 'Unlock session'}
                </Text>
              </Pressable>
              {authStep === 'credentials' ? (
                <Pressable style={styles.secondaryButtonWide} onPress={onRegister}>
                  <Text style={styles.secondaryButtonText}>Register and sign in</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.secondaryButtonWide} onPress={resetAuthFlow}>
                  <Text style={styles.secondaryButtonText}>Start over</Text>
                </Pressable>
              )}
            </View>

            {authStep === 'email' ? (
              <Pressable
                style={styles.inlineGhostButton}
                onPress={requestLoginEmailCode}
                disabled={sendingEmailCode || authLoading || resendCooldown > 0}
              >
                <Text style={styles.inlineGhostButtonText}>
                  {sendingEmailCode ? 'Sending email code...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send email code again'}
                </Text>
              </Pressable>
            ) : null}

            {authLoading ? <ActivityIndicator color="#6fc2ff" style={{ marginTop: 14 }} /> : null}
          </GlassCard>

          <View style={styles.featureStrip}>
            <GlassCard style={styles.featureCard}>
              <Text style={styles.featureKicker}>Secure mode</Text>
              <Text style={styles.featureText}>Ciphertext-only send path on mobile.</Text>
            </GlassCard>
            <GlassCard style={styles.featureCard}>
              <Text style={styles.featureKicker}>Shared backend</Text>
              <Text style={styles.featureText}>Same account state as web and desktop.</Text>
            </GlassCard>
          </View>
        </ScrollView>
      </AppFrame>
    );
  }

  if (view === 'settings') {
    return (
      <AppFrame>
        <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.heroCardCompact}>
            <View style={styles.topRow}>
              <View style={styles.identityRow}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>{getInitials(user?.username)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Device profile</Text>
                  <Text style={styles.cardTitle}>{user ? `@${user.username}` : 'SafeGram mobile'}</Text>
                  <Text style={styles.cardSubtitle}>{connectionHost}</Text>
                </View>
              </View>
              <Pressable style={styles.ghostPill} onPress={() => setView('chats')}>
                <Text style={styles.ghostPillText}>Back</Text>
              </Pressable>
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Connection</Text>
            <Text style={styles.sectionSubtitle}>Keep all clients on the same backend endpoint.</Text>
            <Text style={styles.fieldLabel}>API base</Text>
            <TextInput
              value={apiInput}
              onChangeText={setApiInput}
              autoCapitalize="none"
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor="#6f7e99"
            />
            <Pressable style={styles.primaryButton} onPress={onSaveApiBase}>
              <Text style={styles.primaryButtonText}>Save API endpoint</Text>
            </Pressable>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Security defaults</Text>
            <Text style={styles.sectionSubtitle}>This switch changes the default send mode for the composer.</Text>
            <View style={styles.toggleRowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Secure mode</Text>
                <Text style={styles.toggleText}>When enabled, mobile sends only `ciphertext` using `sg-lite-1`.</Text>
              </View>
              <Switch value={secureMode} onValueChange={onToggleSecureMode} />
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Premium</Text>
            <Text style={styles.sectionSubtitle}>Same subscription state as web and desktop.</Text>

            <View style={styles.pillRowWrap}>
              <View style={[styles.statusPill, premiumInfo?.isPremium ? styles.statusPillSecure : styles.statusPillPlain]}>
                <Text style={styles.statusPillText}>{premiumInfo?.isPremium ? 'Premium active' : 'Free plan'}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{premiumInfo?.provider ? `Provider ${premiumInfo.provider}` : 'Billing API'}</Text>
              </View>
            </View>

            <Text style={styles.premiumStatusLine}>{premiumLoading ? 'Refreshing billing status...' : premiumStatusLine}</Text>

            {premiumPlanCards.length > 0 ? (
              <View style={styles.premiumPlanStack}>
                {premiumPlanCards.map((plan) => {
                  const busy = premiumActionPlanId === plan.id;
                  const highlighted = premiumInfo?.currentPlanId === plan.id;
                  return (
                    <View key={plan.id} style={[styles.premiumPlanCard, highlighted ? styles.premiumPlanCardActive : null]}>
                      <View style={styles.premiumPlanHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.premiumPlanTitle}>{plan.name}</Text>
                          <Text style={styles.premiumPlanDescription}>{plan.description}</Text>
                        </View>
                        <View style={styles.premiumPlanPriceWrap}>
                          <Text style={styles.premiumPlanPrice}>{plan.priceLabel}</Text>
                          <Text style={styles.premiumPlanMeta}>{plan.period}</Text>
                        </View>
                      </View>
                      <Text style={styles.premiumPlanFeatures} numberOfLines={3}>
                        {plan.features.join(' · ')}
                      </Text>
                      <Pressable style={styles.primaryButton} onPress={() => onStartPremiumCheckout(plan.id)} disabled={busy}>
                        <Text style={styles.primaryButtonText}>
                          {busy ? 'Starting checkout...' : highlighted && premiumInfo?.isPremium ? 'Extend plan' : 'Open checkout'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Pressable style={styles.secondaryButtonWide} onPress={() => loadPremiumState()}>
                <Text style={styles.secondaryButtonText}>Load billing catalog</Text>
              </Pressable>
            )}
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Support</Text>
            <Text style={styles.sectionSubtitle}>Create a ticket and continue the conversation in the shared anonymous support chat.</Text>

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {SUPPORT_CATEGORIES.map((option) => {
                const active = supportCategory === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.choiceChip, active ? styles.choiceChipActive : null]}
                    onPress={() => setSupportCategory(option.value)}
                  >
                    <Text style={[styles.choiceChipText, active ? styles.choiceChipTextActive : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>Priority</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {SUPPORT_PRIORITIES.map((option) => {
                const active = supportPriority === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.choiceChip, active ? styles.choiceChipActive : null]}
                    onPress={() => setSupportPriority(option.value)}
                  >
                    <Text style={[styles.choiceChipText, active ? styles.choiceChipTextActive : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              value={supportSubject}
              onChangeText={setSupportSubject}
              style={styles.input}
              placeholder="Login issue, sync bug, account question..."
              placeholderTextColor="#6f7e99"
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              value={supportBody}
              onChangeText={setSupportBody}
              style={[styles.input, styles.multilineInput]}
              placeholder="Explain the issue, steps to reproduce, device, and what you already tried."
              placeholderTextColor="#6f7e99"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.primaryActionsRow}>
              <Pressable style={styles.primaryButton} onPress={onSubmitSupportTicket} disabled={supportSubmitting}>
                <Text style={styles.primaryButtonText}>{supportSubmitting ? 'Creating ticket...' : 'Create support ticket'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButtonWide} onPress={() => loadSupportTicketsSafe()}>
                <Text style={styles.secondaryButtonText}>{supportLoading ? 'Refreshing tickets...' : 'Refresh tickets'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButtonWide} onPress={onOpenSupportPage}>
                <Text style={styles.secondaryButtonText}>Open web support center</Text>
              </Pressable>
            </View>

            <View style={styles.supportListHeader}>
              <Text style={styles.fieldLabel}>Recent tickets</Text>
              {supportLoading ? <ActivityIndicator color="#6fc2ff" size="small" /> : null}
            </View>

            {supportTickets.length > 0 ? (
              <View style={styles.supportTicketStack}>
                {supportTickets.slice(0, 4).map((ticket) => (
                  <Pressable
                    key={ticket.id}
                    style={styles.supportTicketCard}
                    onPress={() => onOpenSupportChat(ticket.chatId)}
                  >
                    <View style={styles.supportTicketTopLine}>
                      <Text style={styles.supportTicketTitle} numberOfLines={1}>{ticket.subject || 'Support ticket'}</Text>
                      <View style={[styles.statusPill, styles.statusPillMuted]}>
                        <Text style={styles.statusPillText}>{ticket.statusLabel || ticket.status || 'Open'}</Text>
                      </View>
                    </View>
                    <Text style={styles.supportTicketBody} numberOfLines={3}>
                      {ticket.body || 'No description'}
                    </Text>
                    <Text style={styles.supportTicketMeta}>
                      {(ticket.category || 'general').toUpperCase()} · {(ticket.priority || 'normal').toUpperCase()} · {humanDate(ticket.lastReplyAt || ticket.updatedAt || ticket.createdAt)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionSubtitle}>No support tickets yet on this account.</Text>
            )}
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Legal</Text>
            <Text style={styles.sectionSubtitle}>Open the same documents that are published on the website.</Text>
            <View style={styles.linkButtonRow}>
              <Pressable style={styles.secondaryButtonWide} onPress={() => onOpenLegal('privacy')}>
                <Text style={styles.secondaryButtonText}>Privacy policy</Text>
              </Pressable>
              <Pressable style={styles.secondaryButtonWide} onPress={() => onOpenLegal('terms')}>
                <Text style={styles.secondaryButtonText}>Terms of use</Text>
              </Pressable>
            </View>
          </GlassCard>

          <Pressable style={styles.dangerButton} onPress={logout}>
            <Text style={styles.dangerButtonText}>Log out from this device</Text>
          </Pressable>
        </ScrollView>
      </AppFrame>
    );
  }

  if (view === 'chat' && selectedChat) {
    return (
      <AppFrame>
        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.chatScreen}>
            <GlassCard style={styles.chatHeaderCard}>
              <View style={styles.topRow}>
                <Pressable
                  style={styles.ghostPill}
                  onPress={() => {
                    setSelectedChat(null);
                    setMessages([]);
                    setAttachmentDraft(null);
                    setView('chats');
                  }}
                >
                  <Text style={styles.ghostPillText}>Back</Text>
                </Pressable>
                <Pressable style={styles.ghostPill} onPress={onRefreshMessages}>
                  <Text style={styles.ghostPillText}>Sync</Text>
                </Pressable>
              </View>

              <View style={styles.chatIdentityRow}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>{getInitials(selectedChatTitle)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{selectedChatTitle}</Text>
                  <Text style={styles.cardSubtitle}>Live DM view on {connectionHost}</Text>
                </View>
              </View>

              <View style={styles.pillRowWrap}>
                <View style={[styles.statusPill, secureMode ? styles.statusPillSecure : styles.statusPillMuted]}>
                  <Text style={styles.statusPillText}>{secureMode ? 'Secure mode on' : 'Plaintext mode'}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>TTL {selectedTtlLabel}</Text>
                </View>
                <Pressable
                  style={[styles.statusPill, secureMode ? styles.statusPillSecure : styles.statusPillPlain]}
                  onPress={() => onToggleSecureMode(!secureMode)}
                >
                  <Text style={styles.statusPillText}>{secureMode ? 'Switch to plain' : 'Switch to secure'}</Text>
                </Pressable>
              </View>
            </GlassCard>

            {messagesLoading ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}

            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              style={styles.flexFill}
              contentContainerStyle={[
                styles.messagesList,
                messages.length === 0 ? styles.messagesListEmpty : null,
              ]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshingMessages} onRefresh={onRefreshMessages} tintColor="#6fc2ff" />}
              ListEmptyComponent={
                <GlassCard style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>No messages yet</Text>
                  <Text style={styles.emptyStateText}>Start the thread with a plain message or a secure ciphertext message.</Text>
                </GlassCard>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.messageBubble,
                    item.fromMe ? styles.messageBubbleMine : styles.messageBubbleOther,
                  ]}
                  onLongPress={() => {
                    const quoted = item.displayText.length > 80 ? `${item.displayText.slice(0, 80)}...` : item.displayText;
                    setComposer((prev) => `${prev ? `${prev}\n` : ''}> ${quoted}\n`);
                  }}
                >
                  <View style={styles.messageHeaderRow}>
                    <Text style={styles.messageSender}>{item.fromMe ? 'You' : getInitials(item.senderId)}</Text>
                    <Text style={styles.messageTime}>{humanRelativeTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.messageText}>{item.displayText}</Text>
                  {item.displayAttachmentUrl ? (
                    <Pressable style={styles.attachmentCard} onPress={() => onOpenAttachment(item.displayAttachmentUrl)}>
                      {isImageAttachment(item.displayAttachmentUrl) ? (
                        <Image source={{ uri: item.displayAttachmentUrl }} style={styles.attachmentImage} />
                      ) : null}
                      <Text style={styles.attachmentTitle}>
                        {isImageAttachment(item.displayAttachmentUrl) ? 'Open image' : 'Open attachment'}
                      </Text>
                      <Text style={styles.attachmentUrl} numberOfLines={1}>
                        {item.displayAttachmentUrl}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.messageMetaLine}>
                    {item.encrypted ? 'Encrypted' : 'Readable'} · {humanDate(item.createdAt)}
                  </Text>
                </Pressable>
              )}
            />

            <GlassCard style={styles.composeDock}>
              <Text style={styles.composeHint}>Hold any message bubble to quote it into the composer.</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
                {QUICK_TEMPLATES.map((template) => (
                  <Pressable
                    key={template}
                    style={styles.templateChip}
                    onPress={() => setComposer((prev) => (prev ? `${prev} ${template}` : template))}
                  >
                    <Text style={styles.templateChipText}>{template}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ttlRow}>
                {TTL_OPTIONS.map((option) => (
                  <Pressable
                    key={option.label}
                    onPress={() => setSelectedTtl(option.value)}
                    style={[styles.ttlChip, selectedTtl === option.value ? styles.ttlChipActive : null]}
                  >
                    <Text style={styles.ttlChipText}>{option.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {attachmentDraft ? (
                <View style={styles.attachmentDraftCard}>
                  <View style={styles.attachmentDraftIcon}>
                    <Text style={styles.attachmentDraftIconText}>FILE</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachmentDraftName} numberOfLines={1}>
                      {attachmentDraft.name}
                    </Text>
                    <Text style={styles.attachmentDraftMeta}>
                      {attachmentDraft.type}
                      {attachmentDraft.size ? ` · ${humanFileSize(attachmentDraft.size)}` : ''}
                    </Text>
                  </View>
                  <Pressable style={styles.ghostPill} onPress={() => setAttachmentDraft(null)}>
                    <Text style={styles.ghostPillText}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.composeToolbar}>
                <Pressable style={styles.secondaryButtonCompact} onPress={onPickAttachment} disabled={pickingAttachment || sendingMessage}>
                  <Text style={styles.secondaryButtonText}>{pickingAttachment ? 'Picking...' : 'Attach'}</Text>
                </Pressable>
                <View style={[styles.statusPill, secureMode ? styles.statusPillSecure : styles.statusPillPlain]}>
                  <Text style={styles.statusPillText}>{secureMode ? 'E2EE lite' : 'Plain send'}</Text>
                </View>
              </View>

              <View style={styles.composerInputShell}>
                <TextInput
                  value={composer}
                  onChangeText={setComposer}
                  style={styles.composerInput}
                  placeholder={secureMode ? 'Write an encrypted message' : 'Write a plaintext message'}
                  placeholderTextColor="#6f7e99"
                  multiline
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    (!composer.trim() && !attachmentDraft) || sendingMessage ? styles.sendButtonDisabled : null,
                  ]}
                  onPress={onSendMessage}
                  disabled={(!composer.trim() && !attachmentDraft) || sendingMessage}
                >
                  <Text style={styles.sendButtonText}>{sendingMessage ? 'Sending' : 'Send'}</Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </KeyboardAvoidingView>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        style={styles.flexFill}
        contentContainerStyle={styles.chatListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshingChats} onRefresh={onRefreshChats} tintColor="#6fc2ff" />}
        ListHeaderComponent={
          <>
            <GlassCard style={styles.heroCardCompact}>
              <View style={styles.topRow}>
                <View style={styles.identityRow}>
                  <View style={styles.avatarLarge}>
                    <Text style={styles.avatarLargeText}>{getInitials(user?.username)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrow}>Encrypted inbox</Text>
                    <Text style={styles.cardTitle}>{user ? `@${user.username}` : 'SafeGram mobile'}</Text>
                    <Text style={styles.cardSubtitle}>{connectionHost}</Text>
                  </View>
                </View>
                <Pressable style={styles.ghostPill} onPress={() => setView('settings')}>
                  <Text style={styles.ghostPillText}>Settings</Text>
                </Pressable>
              </View>

              <View style={styles.pillRowWrap}>
                <View style={[styles.statusPill, secureMode ? styles.statusPillSecure : styles.statusPillPlain]}>
                  <Text style={styles.statusPillText}>{secureMode ? 'Secure send default' : 'Plain send default'}</Text>
                </View>
                <Pressable
                  style={[styles.statusPill, showStarredOnly ? styles.statusPillSecure : styles.statusPillMuted]}
                  onPress={() => setShowStarredOnly((prev) => !prev)}
                >
                  <Text style={styles.statusPillText}>{showStarredOnly ? 'Showing starred only' : 'Showing all chats'}</Text>
                </Pressable>
              </View>
            </GlassCard>

            <View style={styles.statsGrid}>
              <GlassCard style={styles.statCardTall}>
                <Text style={styles.statLabel}>Chats</Text>
                <Text style={styles.statValue}>{chatsStats.total}</Text>
              </GlassCard>
              <GlassCard style={styles.statCardTall}>
                <Text style={styles.statLabel}>Starred</Text>
                <Text style={styles.statValue}>{chatsStats.starred}</Text>
              </GlassCard>
              <GlassCard style={styles.statCardTall}>
                <Text style={styles.statLabel}>DM</Text>
                <Text style={styles.statValue}>{chatsStats.dm}</Text>
              </GlassCard>
              <GlassCard style={styles.statCardTall}>
                <Text style={styles.statLabel}>Groups</Text>
                <Text style={styles.statValue}>{chatsStats.groups}</Text>
              </GlassCard>
            </View>

            <GlassCard>
              <Text style={styles.sectionTitle}>Inbox filters</Text>
              <Text style={styles.sectionSubtitle}>Filter recent chats or create a new direct message.</Text>

              <Text style={styles.fieldLabel}>Search chats</Text>
              <TextInput
                value={chatSearchQ}
                onChangeText={setChatSearchQ}
                style={styles.input}
                placeholder="Filter by name or preview"
                placeholderTextColor="#6f7e99"
              />

              <Text style={styles.fieldLabel}>Find people</Text>
              <View style={styles.searchComposerRow}>
                <TextInput
                  value={searchQ}
                  onChangeText={setSearchQ}
                  style={[styles.input, styles.searchInputInline]}
                  placeholder="Search users for DM"
                  placeholderTextColor="#6f7e99"
                />
                <Pressable style={styles.primaryButtonCompact} onPress={onFindUsers}>
                  <Text style={styles.primaryButtonText}>Find</Text>
                </Pressable>
              </View>

              {searchLoading ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}

              {searchResults.map((result) => (
                <View key={result.id} style={styles.searchResultCard}>
                  <View style={styles.searchIdentityRow}>
                    <View style={styles.avatarSmall}>
                      <Text style={styles.avatarSmallText}>{getInitials(result.username)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultTitle}>{result.username}</Text>
                      <Text style={styles.searchResultText}>Create direct message</Text>
                    </View>
                  </View>
                  <Pressable style={styles.secondaryButtonCompact} onPress={() => onCreateDm(result.id)}>
                    <Text style={styles.secondaryButtonText}>Open DM</Text>
                  </Pressable>
                </View>
              ))}
            </GlassCard>

            <View style={styles.listSectionHeader}>
              <Text style={styles.sectionTitle}>Recent chats</Text>
              <Pressable style={styles.inlineGhostButton} onPress={onRefreshChats}>
                <Text style={styles.inlineGhostButtonText}>Reload</Text>
              </Pressable>
            </View>
            {chatsLoading ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}
          </>
        }
        ListEmptyComponent={
          <GlassCard style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No chats loaded</Text>
            <Text style={styles.emptyStateText}>Search for a user above and create your first DM to start testing.</Text>
          </GlassCard>
        }
        renderItem={({ item }) => {
          const title = getChatCardTitle(item);
          const subtitle = getChatCardSubtitle(item);
          const starred = starredChats.has(item.id);
          return (
            <Pressable style={styles.chatCard} onPress={() => onOpenChat(item)}>
              <View style={styles.chatIdentityRow}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>{getInitials(title)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.chatTopLine}>
                    <Text style={styles.chatTitle}>{title}</Text>
                    <Text style={styles.chatTime}>{humanRelativeTime(item.lastMessage?.createdAt)}</Text>
                  </View>
                  <Text style={styles.chatSubtitle} numberOfLines={2}>{subtitle}</Text>
                  <View style={styles.chatMetaRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{item.type === 'dm' ? 'Direct' : 'Group'}</Text>
                    </View>
                    {item.lastMessage?.ciphertext ? (
                      <View style={[styles.metaPill, styles.metaPillSecure]}>
                        <Text style={styles.metaPillText}>Encrypted</Text>
                      </View>
                    ) : null}
                    {item.lastMessage?.attachmentUrl ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>File</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <Pressable style={[styles.starButton, starred ? styles.starButtonActive : null]} onPress={() => onToggleStarChat(item.id)}>
                <Text style={styles.starButtonText}>{starred ? 'Starred' : 'Star'}</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050b14',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050b14',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },
  glowOrbA: {
    width: 280,
    height: 280,
    backgroundColor: '#12396a',
    top: -90,
    right: -60,
  },
  glowOrbB: {
    width: 220,
    height: 220,
    backgroundColor: '#0f7a68',
    bottom: 120,
    left: -80,
  },
  glowOrbC: {
    width: 160,
    height: 160,
    backgroundColor: '#092342',
    top: 220,
    left: 80,
  },
  backdropNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 11, 20, 0.82)',
  },
  frame: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  flexFill: {
    flex: 1,
  },
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bootBadge: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: 'rgba(111, 194, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  bootBadgeText: {
    color: '#eef7ff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bootEyebrow: {
    color: '#7aa7d9',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    marginBottom: 10,
  },
  bootTitle: {
    color: '#f5fbff',
    fontSize: 34,
    fontWeight: '800',
  },
  bootText: {
    color: '#9ab0c8',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    maxWidth: 320,
  },
  authScreenContent: {
    paddingBottom: 36,
    gap: 16,
  },
  screenContent: {
    paddingBottom: 32,
    gap: 14,
  },
  glassCard: {
    backgroundColor: 'rgba(12, 20, 34, 0.84)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(129, 159, 196, 0.16)',
    padding: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  heroCard: {
    paddingTop: 22,
    paddingBottom: 20,
  },
  heroCardCompact: {
    paddingTop: 18,
    paddingBottom: 18,
  },
  eyebrow: {
    color: '#78b8ff',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    marginBottom: 10,
  },
  heroTitle: {
    color: '#f8fbff',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroText: {
    color: '#9cb3cc',
    fontSize: 15,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  stepChip: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(124, 146, 176, 0.18)',
    backgroundColor: 'rgba(8, 14, 24, 0.45)',
    padding: 12,
    justifyContent: 'space-between',
  },
  stepChipActive: {
    backgroundColor: 'rgba(24, 63, 111, 0.45)',
    borderColor: 'rgba(111, 194, 255, 0.45)',
  },
  stepChipDone: {
    backgroundColor: 'rgba(16, 75, 61, 0.45)',
    borderColor: 'rgba(63, 219, 164, 0.35)',
  },
  stepChipNumber: {
    color: '#6fc2ff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stepChipLabel: {
    color: '#edf6ff',
    fontSize: 13,
    fontWeight: '700',
  },
  heroMetricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  heroMetricCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(6, 12, 22, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(109, 140, 178, 0.18)',
    padding: 14,
  },
  heroMetricValue: {
    color: '#f8fbff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroMetricLabel: {
    color: '#8da6c2',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#f5fbff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#8ea6c2',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#dce9f7',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(4, 10, 18, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    color: '#eff7ff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 140,
  },
  challengeCard: {
    marginBottom: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.25)',
    backgroundColor: 'rgba(15, 27, 47, 0.9)',
    padding: 14,
  },
  challengeTitle: {
    color: '#edf7ff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  challengeText: {
    color: '#94b0cf',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  devCode: {
    color: '#d9ecff',
    backgroundColor: 'rgba(18, 41, 69, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.22)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
  },
  primaryActionsRow: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#1688ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonCompact: {
    minWidth: 86,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#1688ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(18, 28, 44, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonWide: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(18, 28, 44, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonCompact: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 28, 44, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#dcecff',
    fontWeight: '700',
    fontSize: 14,
  },
  inlineGhostButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.22)',
    paddingHorizontal: 14,
    justifyContent: 'center',
    marginTop: 10,
  },
  inlineGhostButtonText: {
    color: '#bcdcff',
    fontWeight: '700',
    fontSize: 13,
  },
  featureStrip: {
    flexDirection: 'row',
    gap: 12,
  },
  featureCard: {
    flex: 1,
  },
  featureKicker: {
    color: '#6fc2ff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  featureText: {
    color: '#a4b9d1',
    fontSize: 13,
    lineHeight: 19,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarLarge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 53, 93, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    color: '#f3fbff',
    fontSize: 17,
    fontWeight: '800',
  },
  avatarSmall: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 53, 93, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    color: '#edf8ff',
    fontSize: 13,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#f5fbff',
    fontSize: 22,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#8da5bf',
    fontSize: 13,
    marginTop: 4,
  },
  ghostPill: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.18)',
    backgroundColor: 'rgba(6, 12, 22, 0.52)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostPillText: {
    color: '#c9e5ff',
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(12, 20, 34, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillSecure: {
    backgroundColor: 'rgba(9, 62, 49, 0.84)',
    borderColor: 'rgba(72, 213, 169, 0.28)',
  },
  statusPillPlain: {
    backgroundColor: 'rgba(58, 31, 31, 0.84)',
    borderColor: 'rgba(214, 111, 111, 0.22)',
  },
  statusPillMuted: {
    backgroundColor: 'rgba(19, 29, 43, 0.82)',
  },
  statusPillText: {
    color: '#e7f3ff',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRowCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    backgroundColor: 'rgba(4, 10, 18, 0.58)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  toggleTitle: {
    color: '#f4faff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  toggleText: {
    color: '#92abc7',
    fontSize: 13,
    lineHeight: 19,
  },
  premiumStatusLine: {
    color: '#d8e7f8',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 12,
  },
  premiumPlanStack: {
    gap: 12,
  },
  premiumPlanCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    backgroundColor: 'rgba(4, 10, 18, 0.58)',
    padding: 14,
    gap: 12,
  },
  premiumPlanCardActive: {
    borderColor: 'rgba(111, 194, 255, 0.3)',
    backgroundColor: 'rgba(16, 34, 57, 0.76)',
  },
  premiumPlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  premiumPlanTitle: {
    color: '#f5fbff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  premiumPlanDescription: {
    color: '#96aec9',
    fontSize: 13,
    lineHeight: 19,
  },
  premiumPlanPriceWrap: {
    alignItems: 'flex-end',
  },
  premiumPlanPrice: {
    color: '#6fc2ff',
    fontSize: 16,
    fontWeight: '800',
  },
  premiumPlanMeta: {
    color: '#8ca5c0',
    fontSize: 12,
    marginTop: 4,
  },
  premiumPlanFeatures: {
    color: '#dcecff',
    fontSize: 13,
    lineHeight: 20,
  },
  supportListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  supportTicketStack: {
    gap: 10,
  },
  supportTicketCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    backgroundColor: 'rgba(4, 10, 18, 0.58)',
    padding: 14,
    gap: 8,
  },
  supportTicketTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  supportTicketTitle: {
    color: '#f5fbff',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  supportTicketBody: {
    color: '#96aec9',
    fontSize: 13,
    lineHeight: 19,
  },
  supportTicketMeta: {
    color: '#8ca5c0',
    fontSize: 11,
  },
  linkButtonRow: {
    gap: 10,
  },
  dangerButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(90, 24, 24, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(228, 115, 115, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dangerButtonText: {
    color: '#fff1f1',
    fontSize: 15,
    fontWeight: '800',
  },
  chatScreen: {
    flex: 1,
    gap: 12,
  },
  chatHeaderCard: {
    paddingBottom: 16,
  },
  chatIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pillRowWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 14,
  },
  inlineLoader: {
    marginVertical: 10,
  },
  messagesList: {
    gap: 10,
    paddingBottom: 8,
  },
  messagesListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyStateCard: {
    alignItems: 'flex-start',
  },
  emptyStateTitle: {
    color: '#f3fbff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyStateText: {
    color: '#93abc7',
    fontSize: 14,
    lineHeight: 21,
  },
  messageBubble: {
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    maxWidth: '92%',
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(17, 66, 117, 0.9)',
    borderColor: 'rgba(111, 194, 255, 0.28)',
  },
  messageBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13, 20, 32, 0.92)',
    borderColor: 'rgba(109, 136, 168, 0.18)',
  },
  messageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  messageSender: {
    color: '#cfe6ff',
    fontSize: 12,
    fontWeight: '800',
  },
  messageTime: {
    color: '#8ea8c5',
    fontSize: 11,
    fontWeight: '600',
  },
  messageText: {
    color: '#f5fbff',
    fontSize: 15,
    lineHeight: 21,
  },
  messageMetaLine: {
    color: '#90a9c5',
    fontSize: 11,
    marginTop: 8,
  },
  attachmentCard: {
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.18)',
    borderRadius: 18,
    backgroundColor: 'rgba(5, 12, 22, 0.52)',
    padding: 8,
    marginTop: 10,
    gap: 8,
  },
  attachmentImage: {
    width: 220,
    height: 140,
    borderRadius: 14,
    backgroundColor: '#0d1624',
  },
  attachmentTitle: {
    color: '#d7eaff',
    fontWeight: '800',
    fontSize: 13,
  },
  attachmentUrl: {
    color: '#8ea8c5',
    fontSize: 11,
  },
  composeDock: {
    gap: 10,
    paddingBottom: 14,
  },
  composeHint: {
    color: '#8ea7c5',
    fontSize: 12,
    lineHeight: 18,
  },
  templateRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chipRow: {
    gap: 8,
    paddingBottom: 12,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(6, 12, 22, 0.52)',
  },
  choiceChipActive: {
    backgroundColor: 'rgba(16, 53, 93, 0.84)',
    borderColor: 'rgba(111, 194, 255, 0.28)',
  },
  choiceChipText: {
    color: '#d6ebff',
    fontSize: 12,
    fontWeight: '700',
  },
  choiceChipTextActive: {
    color: '#f7fbff',
  },
  templateChip: {
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(6, 12, 22, 0.52)',
  },
  templateChipText: {
    color: '#d2e8ff',
    fontSize: 12,
    fontWeight: '700',
  },
  ttlRow: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  ttlChip: {
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(6, 12, 22, 0.52)',
  },
  ttlChipActive: {
    backgroundColor: 'rgba(16, 53, 93, 0.84)',
    borderColor: 'rgba(111, 194, 255, 0.28)',
  },
  ttlChipText: {
    color: '#d6ebff',
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentDraftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.18)',
    borderRadius: 18,
    backgroundColor: 'rgba(6, 12, 22, 0.58)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  attachmentDraftIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 66, 117, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentDraftIconText: {
    color: '#f5fbff',
    fontSize: 10,
    fontWeight: '800',
  },
  attachmentDraftName: {
    color: '#eff8ff',
    fontWeight: '800',
    fontSize: 13,
  },
  attachmentDraftMeta: {
    color: '#95acc8',
    fontSize: 11,
    marginTop: 2,
  },
  composeToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  composerInputShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: 'rgba(4, 10, 18, 0.76)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    padding: 10,
  },
  composerInput: {
    flex: 1,
    color: '#f3fbff',
    fontSize: 15,
    lineHeight: 21,
    minHeight: 46,
    maxHeight: 128,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  sendButton: {
    minHeight: 44,
    minWidth: 76,
    borderRadius: 16,
    backgroundColor: '#1688ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  chatListContent: {
    paddingBottom: 28,
    gap: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCardTall: {
    width: '48.2%',
    minHeight: 92,
    justifyContent: 'space-between',
  },
  statLabel: {
    color: '#93abc7',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    color: '#f4fbff',
    fontWeight: '800',
    fontSize: 26,
  },
  searchComposerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  searchInputInline: {
    flex: 1,
    marginBottom: 0,
  },
  searchResultCard: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    backgroundColor: 'rgba(5, 11, 20, 0.58)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  searchResultTitle: {
    color: '#f2f9ff',
    fontWeight: '800',
    fontSize: 15,
  },
  searchResultText: {
    color: '#8ea7c5',
    fontSize: 12,
    marginTop: 2,
  },
  listSectionHeader: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatCard: {
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.16)',
    borderRadius: 24,
    backgroundColor: 'rgba(12, 20, 34, 0.84)',
    padding: 14,
    gap: 12,
  },
  chatTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chatTitle: {
    color: '#f5fbff',
    fontWeight: '800',
    fontSize: 17,
    flex: 1,
  },
  chatTime: {
    color: '#7f98b6',
    fontSize: 12,
    fontWeight: '600',
  },
  chatSubtitle: {
    color: '#9ab0ca',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  chatMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(5, 12, 22, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillSecure: {
    backgroundColor: 'rgba(9, 62, 49, 0.84)',
    borderColor: 'rgba(72, 213, 169, 0.22)',
  },
  metaPillText: {
    color: '#d7ebff',
    fontSize: 11,
    fontWeight: '700',
  },
  starButton: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    backgroundColor: 'rgba(6, 12, 22, 0.52)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  starButtonActive: {
    backgroundColor: 'rgba(70, 59, 15, 0.82)',
    borderColor: 'rgba(246, 207, 79, 0.26)',
  },
  starButtonText: {
    color: '#f5f0cb',
    fontWeight: '800',
    fontSize: 12,
  },
});
