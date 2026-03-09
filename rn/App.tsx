import 'react-native-get-random-values';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import {
  AuthUser,
  ChatSummary,
  createDm,
  getChats,
  getMessages,
  getSavedApiBase,
  loginUser,
  MessageItem,
  normalizeApiBase,
  registerUser,
  saveApiBase,
  searchUsers,
  sendLoginEmailCode,
  sendMessage,
  STORAGE_KEYS,
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

const QUICK_TEMPLATES = ['Принял', 'Ок, проверю', 'Созвон в 18:00?', 'Спасибо!', 'Нужна помощь'];
const STARRED_CHATS_KEY = 'sg_starred_chats';

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

export default function App() {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<ViewMode>('auth');
  const [apiBase, setApiBase] = useState('https://141.8.198.152.nip.io');
  const [apiInput, setApiInput] = useState('https://141.8.198.152.nip.io');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
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

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
    setToken(null);
    setUser(null);
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
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.token, nextToken],
      [STORAGE_KEYS.user, JSON.stringify(nextUser)],
    ]);
    setToken(nextToken);
    setUser(nextUser);
    setUsername('');
    setPassword('');
    resetAuthFlow();
    setView('chats');
  }, [resetAuthFlow]);

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
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ActivityIndicator color="#39ff14" />
        <Text style={styles.hint}>Booting SafeGram...</Text>
      </SafeAreaView>
    );
  }

  if (view === 'auth') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.title}>SafeGram Tonight</Text>
        <Text style={styles.hint}>
          {authStep === 'credentials'
            ? 'ID + password flow for smoke-test'
            : authStep === 'email'
            ? 'Step 2/3: confirm login by email code'
            : 'Step 3/3: enter your cloud PIN'}
        </Text>

        <Text style={styles.label}>API Base</Text>
        <TextInput
          value={apiInput}
          onChangeText={setApiInput}
          autoCapitalize="none"
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor="#74809b"
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            if (authStep !== 'credentials') resetAuthFlow();
          }}
          autoCapitalize="none"
          style={styles.input}
          placeholder="username"
          placeholderTextColor="#74809b"
          editable={!authLoading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (authStep !== 'credentials') resetAuthFlow();
          }}
          secureTextEntry
          style={styles.input}
          placeholder="password"
          placeholderTextColor="#74809b"
          editable={!authLoading}
        />

        {authStep === 'email' ? (
          <>
            <Text style={styles.label}>Email code</Text>
            <TextInput
              value={emailCode}
              onChangeText={(value) => setEmailCode(value.replace(/\D/g, '').slice(0, 6))}
              autoCapitalize="none"
              keyboardType="number-pad"
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor="#74809b"
              editable={!authLoading}
            />
            <Text style={styles.hintCompact}>
              {authHint || 'A login code is required for this account.'}
            </Text>
            {devEmailCode ? (
              <Text style={styles.devCode}>Dev code: {devEmailCode}</Text>
            ) : null}
          </>
        ) : null}

        {authStep === 'cloudCode' ? (
          <>
            <Text style={styles.label}>Cloud code</Text>
            <TextInput
              value={cloudCode}
              onChangeText={setCloudCode}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
              placeholder="PIN / cloud code"
              placeholderTextColor="#74809b"
              editable={!authLoading}
            />
            <Text style={styles.hintCompact}>
              {authHint || 'Enter the cloud code configured for this account.'}
            </Text>
          </>
        ) : null}

        <View style={styles.row}>
          <Pressable style={styles.buttonGhost} onPress={onSaveApiBase}>
            <Text style={styles.buttonGhostText}>Save API</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={onLogin}>
            <Text style={styles.buttonText}>
              {authStep === 'credentials' ? 'Login' : authStep === 'email' ? 'Verify code' : 'Unlock'}
            </Text>
          </Pressable>
        </View>

        {authStep === 'credentials' ? (
          <Pressable style={styles.buttonSecondary} onPress={onRegister}>
            <Text style={styles.buttonText}>Register + Login</Text>
          </Pressable>
        ) : (
          <View style={styles.row}>
            {authStep === 'email' ? (
              <Pressable
                style={[styles.buttonSecondary, styles.flexButton]}
                onPress={requestLoginEmailCode}
                disabled={sendingEmailCode || authLoading || resendCooldown > 0}
              >
                <Text style={styles.buttonText}>
                  {sendingEmailCode ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send code'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.buttonSecondary, styles.flexButton]} onPress={resetAuthFlow}>
              <Text style={styles.buttonText}>Start over</Text>
            </Pressable>
          </View>
        )}

        {authLoading ? <ActivityIndicator color="#39ff14" style={{ marginTop: 10 }} /> : null}
      </SafeAreaView>
    );
  }

  if (view === 'settings') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Settings</Text>
          <Pressable style={styles.buttonGhost} onPress={() => setView('chats')}>
            <Text style={styles.buttonGhostText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>API Base</Text>
        <TextInput
          value={apiInput}
          onChangeText={setApiInput}
          autoCapitalize="none"
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor="#74809b"
        />
        <Pressable style={styles.button} onPress={onSaveApiBase}>
          <Text style={styles.buttonText}>Save API</Text>
        </Pressable>

        <View style={[styles.row, { marginTop: 20 }]}> 
          <Text style={styles.label}>Secure mode (E2EE-lite)</Text>
          <Switch value={secureMode} onValueChange={onToggleSecureMode} />
        </View>

        <Text style={styles.hint}>
          Secure mode ON: send only ciphertext using sg-lite-1 envelope.
        </Text>

        <Pressable style={[styles.buttonSecondary, { marginTop: 24 }]} onPress={logout}>
          <Text style={styles.buttonText}>Logout</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (view === 'chat' && selectedChat) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.headerRow}>
          <Pressable
            style={styles.buttonGhost}
            onPress={() => {
              setSelectedChat(null);
              setMessages([]);
              setAttachmentDraft(null);
              setView('chats');
            }}
          >
            <Text style={styles.buttonGhostText}>Back</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.titleSmall}>{selectedChatTitle}</Text>
            <Text style={styles.hint}>
              {secureMode ? 'Secure mode ON' : 'Secure mode OFF'} | {selectedTtl ? `TTL ${selectedTtl}ms` : 'TTL off'}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <Pressable style={styles.buttonGhost} onPress={onRefreshMessages}>
              <Text style={styles.buttonGhostText}>Refresh</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonGhost, secureMode ? styles.secureBadgeOn : styles.secureBadgeOff]}
              onPress={() => onToggleSecureMode(!secureMode)}
            >
              <Text style={styles.buttonGhostText}>{secureMode ? '🔐 E2EE' : '🔓 Plain'}</Text>
            </Pressable>
          </View>
        </View>

        {messagesLoading ? <ActivityIndicator color="#39ff14" /> : null}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          refreshControl={<RefreshControl refreshing={refreshingMessages} onRefresh={onRefreshMessages} tintColor="#39ff14" />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.messageBubble, item.fromMe ? styles.messageMe : styles.messageOther]}
              onLongPress={() => {
                const quoted = item.displayText.length > 80 ? `${item.displayText.slice(0, 80)}...` : item.displayText;
                setComposer((prev) => `${prev ? `${prev}\n` : ''}> ${quoted}\n`);
              }}
            >
              <Text style={styles.messageMeta}>{item.fromMe ? 'You' : item.senderId}</Text>
              <Text style={styles.messageText}>{item.displayText}</Text>
              {item.displayAttachmentUrl ? (
                <Pressable
                  style={styles.attachmentCard}
                  onPress={() => onOpenAttachment(item.displayAttachmentUrl)}
                >
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
              <Text style={styles.messageMeta}>
                {item.encrypted ? 'encrypted | ' : ''}
                {humanDate(item.createdAt)}
              </Text>
            </Pressable>
          )}
        />

        <Text style={styles.hintCompact}>Long press message to quote</Text>

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ttlRow}
        >
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
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentDraftName} numberOfLines={1}>
                {attachmentDraft.name}
              </Text>
              <Text style={styles.attachmentDraftMeta}>
                {attachmentDraft.type}
                {attachmentDraft.size ? ` • ${humanFileSize(attachmentDraft.size)}` : ''}
              </Text>
            </View>
            <Pressable style={styles.buttonGhost} onPress={() => setAttachmentDraft(null)}>
              <Text style={styles.buttonGhostText}>Remove</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composerRow}>
          <Pressable style={styles.buttonGhost} onPress={onPickAttachment} disabled={pickingAttachment || sendingMessage}>
            <Text style={styles.buttonGhostText}>{pickingAttachment ? 'Picking...' : 'Attach'}</Text>
          </Pressable>
          <TextInput
            value={composer}
            onChangeText={setComposer}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder={secureMode ? 'Encrypted message (hold message to quote)' : 'Plaintext message'}
            placeholderTextColor="#74809b"
            multiline
          />
          <Pressable
            style={[
              styles.button,
              !composer.trim() && !attachmentDraft ? styles.buttonDisabled : null,
              sendingMessage ? styles.buttonDisabled : null,
            ]}
            onPress={onSendMessage}
            disabled={(!composer.trim() && !attachmentDraft) || sendingMessage}
          >
            <Text style={styles.buttonText}>{sendingMessage ? 'Sending...' : 'Send'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerRow}>
        <Text style={styles.title}>Chats</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.buttonGhost, showStarredOnly ? styles.starFilterActive : null]}
            onPress={() => setShowStarredOnly((prev) => !prev)}
          >
            <Text style={styles.buttonGhostText}>{showStarredOnly ? '★ Starred' : '☆ All'}</Text>
          </Pressable>
          <Pressable style={styles.buttonGhost} onPress={() => setView('settings')}>
            <Text style={styles.buttonGhostText}>Settings</Text>
          </Pressable>
          <Pressable style={styles.buttonGhost} onPress={onRefreshChats}>
            <Text style={styles.buttonGhostText}>Reload</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.hint}>{user ? `@${user.username}` : ''}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Chats</Text>
          <Text style={styles.statValue}>{chatsStats.total}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Starred</Text>
          <Text style={styles.statValue}>{chatsStats.starred}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>DM</Text>
          <Text style={styles.statValue}>{chatsStats.dm}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Groups</Text>
          <Text style={styles.statValue}>{chatsStats.groups}</Text>
        </View>
      </View>

      <TextInput
        value={chatSearchQ}
        onChangeText={setChatSearchQ}
        style={styles.input}
        placeholder="Filter chats by name/message"
        placeholderTextColor="#74809b"
      />

      <View style={styles.searchBlock}>
        <TextInput
          value={searchQ}
          onChangeText={setSearchQ}
          style={styles.input}
          placeholder="Search users for DM"
          placeholderTextColor="#74809b"
        />
        <Pressable style={styles.button} onPress={onFindUsers}>
          <Text style={styles.buttonText}>Find</Text>
        </Pressable>
        {searchLoading ? <ActivityIndicator color="#39ff14" /> : null}
        {searchResults.map((result) => (
          <View key={result.id} style={styles.searchRow}>
            <Text style={styles.searchText}>{result.username}</Text>
            <Pressable style={styles.buttonGhost} onPress={() => onCreateDm(result.id)}>
              <Text style={styles.buttonGhostText}>Create DM</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {chatsLoading ? <ActivityIndicator color="#39ff14" /> : null}

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshingChats} onRefresh={onRefreshChats} tintColor="#39ff14" />}
        renderItem={({ item }) => (
          <View style={styles.chatCard}>
            <Pressable style={{ flex: 1 }} onPress={() => onOpenChat(item)}>
              <Text style={styles.chatTitle}>
                {starredChats.has(item.id) ? '★ ' : ''}
                {getChatCardTitle(item)}
              </Text>
              <Text style={styles.chatSub}>{getChatCardSubtitle(item)}</Text>
            </Pressable>
            <Pressable
              style={styles.chatStarButton}
              onPress={() => onToggleStarChat(item.id)}
            >
              <Text style={styles.chatStarText}>{starredChats.has(item.id) ? '★' : '☆'}</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    color: '#f5f7ff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleSmall: {
    color: '#f5f7ff',
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    color: '#95a0b8',
    marginBottom: 10,
  },
  hintCompact: {
    color: '#7f90ac',
    marginBottom: 6,
    fontSize: 12,
  },
  devCode: {
    color: '#c8d7ff',
    backgroundColor: '#121f34',
    borderWidth: 1,
    borderColor: '#2d466e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontWeight: '700',
  },
  label: {
    color: '#d9def0',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    backgroundColor: '#121822',
    borderWidth: 1,
    borderColor: '#1e2b3f',
    color: '#edf2ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007aff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonSecondary: {
    backgroundColor: '#1a2638',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: '#2d466e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  buttonGhostText: {
    color: '#b8d6ff',
    fontWeight: '700',
  },
  starFilterActive: {
    backgroundColor: '#17273e',
    borderColor: '#5d8fd4',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1e2b3f',
    borderRadius: 10,
    backgroundColor: '#0f1724',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  statLabel: {
    color: '#90a1bb',
    fontSize: 11,
  },
  statValue: {
    color: '#ecf4ff',
    fontWeight: '700',
    fontSize: 16,
  },
  searchBlock: {
    marginBottom: 12,
    gap: 8,
  },
  searchRow: {
    borderWidth: 1,
    borderColor: '#1e2b3f',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111722',
  },
  searchText: {
    color: '#f5f7ff',
    fontWeight: '600',
  },
  chatCard: {
    borderWidth: 1,
    borderColor: '#1e2b3f',
    borderRadius: 12,
    backgroundColor: '#121822',
    padding: 12,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTitle: {
    color: '#f5f7ff',
    fontWeight: '700',
    fontSize: 16,
  },
  chatSub: {
    color: '#9fb1d5',
    fontSize: 12,
  },
  chatStarButton: {
    borderWidth: 1,
    borderColor: '#2e4568',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  chatStarText: {
    color: '#f6cf4f',
    fontSize: 14,
    fontWeight: '700',
  },
  messagesList: {
    gap: 8,
    paddingBottom: 12,
  },
  messageBubble: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    maxWidth: '95%',
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#133151',
    borderColor: '#2264a8',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#131a25',
    borderColor: '#27344b',
  },
  messageMeta: {
    color: '#8da0c5',
    fontSize: 11,
  },
  messageText: {
    color: '#f5f7ff',
    marginVertical: 4,
  },
  attachmentCard: {
    borderWidth: 1,
    borderColor: '#2d466e',
    borderRadius: 10,
    backgroundColor: '#101a2a',
    padding: 8,
    marginBottom: 6,
    gap: 6,
  },
  attachmentImage: {
    width: 220,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#0f1725',
  },
  attachmentTitle: {
    color: '#d6e8ff',
    fontWeight: '700',
    fontSize: 12,
  },
  attachmentUrl: {
    color: '#8fa8cf',
    fontSize: 11,
  },
  attachmentDraftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#234a78',
    borderRadius: 10,
    backgroundColor: '#111e2f',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  attachmentDraftName: {
    color: '#ecf4ff',
    fontWeight: '700',
    fontSize: 12,
  },
  attachmentDraftMeta: {
    color: '#9fb4d5',
    fontSize: 11,
    marginTop: 2,
  },
  ttlRow: {
    gap: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  templateRow: {
    gap: 8,
    paddingVertical: 4,
  },
  templateChip: {
    borderWidth: 1,
    borderColor: '#21436d',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#101a2b',
  },
  templateChipText: {
    color: '#d4e7ff',
    fontSize: 12,
    fontWeight: '600',
  },
  ttlChip: {
    borderWidth: 1,
    borderColor: '#2d466e',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ttlChipActive: {
    backgroundColor: '#1f3e68',
    borderColor: '#60a6ff',
  },
  ttlChipText: {
    color: '#d7e9ff',
    fontSize: 12,
    fontWeight: '700',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    marginTop: 4,
  },
  secureBadgeOn: {
    backgroundColor: '#13283f',
    borderColor: '#2f66a6',
  },
  secureBadgeOff: {
    backgroundColor: '#2b1a1a',
    borderColor: '#694242',
  },
});
