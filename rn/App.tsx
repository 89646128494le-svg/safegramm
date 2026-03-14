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
  Share,
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
  archiveChat as archiveChatRequest,
  AdminAnalyticsSummary,
  AdminBanRecord,
  AdminBannedWordRecord,
  AdminFeedbackTicket,
  AdminMaintenanceStatus,
  AdminPremiumDashboard,
  AdminStatsSnapshot,
  AdminSystemBannerStatus,
  AdminSystemHealth,
  AdminUserRecord,
  AuthUser,
  BillingPlan,
  ChatSummary,
  clearAdmin2FAToken,
  checkoutPremium,
  createAdminBan,
  createAdminBannedWord,
  addServerMembersBulk,
  createServer,
  createServerCategory,
  createServerChannel,
  createServerRole,
  createSupportTicket,
  createVoiceRoom,
  createDm,
  DEFAULT_API_BASE,
  deleteChat as deleteChatRequest,
  deleteAdminBan,
  deleteAdminBannedWord,
  deleteServerCategory,
  deleteServerChannel,
  deleteServerRole,
  disableAdminMaintenance,
  disableAdminSystemBanner,
  getAdmin2FAStatus,
  getAdminAnalytics,
  getAdminBannedWords,
  getAdminBans,
  getAdminFeedback,
  getAdminMaintenance,
  getAdminModQueue,
  getAdminPremiumDashboard,
  getAdminReports,
  getAdminStats,
  getAdminSystemBanner,
  getAdminSystemHealth,
  getAdminUsers,
  getBillingPlans,
  getChats,
  getMessages,
  getPremiumInfo,
  getServer,
  getServerCategories,
  getServerChannels,
  getServerMembers,
  getServers,
  getServerVoiceState,
  getCurrentUser,
  getSavedAdmin2FAToken,
  getServerHistory,
  getSupportTickets,
  getVoiceRoom,
  loginUser,
  leaveServer,
  joinServerByInvite,
  MessageItem,
  MemberEventRecord,
  normalizeApiBase,
  patchAdminFeedback,
  patchAdminBannedWord,
  PremiumInfo,
  registerUser,
  saveAdmin2FAToken,
  searchUsers,
  sendLoginEmailCode,
  sendMessage,
  setServerChannelCategory,
  ServerRoleRecord,
  ServerCategory,
  ServerChannel,
  ServerMemberRecord,
  ServerSummary,
  setAdminMaintenance,
  setAdminSystemBanner,
  setServerMemberRole,
  setServerMemberRoles,
  STORAGE_KEYS,
  suspendAdminUser,
  SupportTicket,
  unarchiveChat as unarchiveChatRequest,
  unblockAdminUser,
  unsuspendAdminUser,
  updateServer,
  updateServerRole,
  uploadAttachment,
  verifyAdmin2FA,
  VoiceRoomRecord,
  blockAdminUser,
  endVoiceRoom,
  generateServerInviteLink,
  getServerRoles,
} from './src/lib/mobileApi';
import { decryptForChat, encryptForChat, isLiteCiphertext } from './src/lib/e2eeLite';
import {
  getAvailableStaffSections,
  getDefaultStaffSection,
  getRoleLabel,
  hasRoleAtLeast,
  hasStaffAccess,
  StaffSectionId,
} from './src/lib/staffRoles';

type ViewMode = 'auth' | 'chats' | 'chat' | 'settings' | 'admin' | 'servers' | 'server';
type AuthStep = 'credentials' | 'email' | 'cloudCode';
type ChatOrigin = 'chats' | 'server';

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
const BRAND_MARK = require('./assets/brand-mark.png');
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
const ADMIN_FEEDBACK_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_user', label: 'Waiting for user' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const SYSTEM_BANNER_SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];
const STARRED_CHATS_KEY = 'sg_starred_chats';
const LEGAL_BASE = 'https://safegram.site';
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
  const [apiBase] = useState(DEFAULT_API_BASE);
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
  const [chatOrigin, setChatOrigin] = useState<ChatOrigin>('chats');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composer, setComposer] = useState('');
  const [selectedTtl, setSelectedTtl] = useState(0);
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ServerSummary | null>(null);
  const [serverChannels, setServerChannels] = useState<ServerChannel[]>([]);
  const [serverCategories, setServerCategories] = useState<ServerCategory[]>([]);
  const [serverMembers, setServerMembers] = useState<ServerMemberRecord[]>([]);
  const [serverVoiceState, setServerVoiceState] = useState<Record<string, string[]>>({});
  const [serverBusy, setServerBusy] = useState(false);
  const [serverDraftName, setServerDraftName] = useState('');
  const [serverDraftDescription, setServerDraftDescription] = useState('');
  const [serverJoinCode, setServerJoinCode] = useState('');
  const [serverSettingsName, setServerSettingsName] = useState('');
  const [serverSettingsDescription, setServerSettingsDescription] = useState('');
  const [serverInviteLink, setServerInviteLink] = useState('');
  const [channelDraftName, setChannelDraftName] = useState('');
  const [channelDraftType, setChannelDraftType] = useState<'text' | 'voice'>('text');
  const [categoryDraftName, setCategoryDraftName] = useState('');
  const [selectedVoiceChannelId, setSelectedVoiceChannelId] = useState('');
  const [selectedVoiceRoom, setSelectedVoiceRoom] = useState<VoiceRoomRecord | null>(null);
  const [serverRoles, setServerRoles] = useState<ServerRoleRecord[]>([]);
  const [serverAllPermissions, setServerAllPermissions] = useState<string[]>([]);
  const [serverHistory, setServerHistory] = useState<MemberEventRecord[]>([]);
  const [serverRoleDraftName, setServerRoleDraftName] = useState('');
  const [serverRoleDraftColor, setServerRoleDraftColor] = useState('99aab5');
  const [serverRoleDraftPermissions, setServerRoleDraftPermissions] = useState<string[]>([]);
  const [editingServerRoleId, setEditingServerRoleId] = useState('');
  const [serverMemberSearchQ, setServerMemberSearchQ] = useState('');
  const [serverMemberSearchLoading, setServerMemberSearchLoading] = useState(false);
  const [serverMemberSearchResults, setServerMemberSearchResults] = useState<Array<{ id: string; username: string }>>([]);
  const [pendingEntryServerId, setPendingEntryServerId] = useState('');
  const [pendingEntryTextChannelId, setPendingEntryTextChannelId] = useState('');
  const [pendingEntryVoiceChannelId, setPendingEntryVoiceChannelId] = useState('');

  const [searchQ, setSearchQ] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string }>>([]);
  const [chatSearchQ, setChatSearchQ] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
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
  const [adminSection, setAdminSection] = useState<StaffSectionId>('support');
  const [adminGateLoading, setAdminGateLoading] = useState(false);
  const [adminTwoFactorEnabled, setAdminTwoFactorEnabled] = useState(false);
  const [adminTwoFactorToken, setAdminTwoFactorToken] = useState<string | null>(null);
  const [adminTwoFactorCode, setAdminTwoFactorCode] = useState('');
  const [adminStats, setAdminStats] = useState<AdminStatsSnapshot | null>(null);
  const [adminHealth, setAdminHealth] = useState<AdminSystemHealth | null>(null);
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [adminPremium, setAdminPremium] = useState<AdminPremiumDashboard | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminFeedback, setAdminFeedback] = useState<AdminFeedbackTicket[]>([]);
  const [adminFeedbackStatus, setAdminFeedbackStatus] = useState('open');
  const [adminMaintenance, setAdminMaintenanceState] = useState<AdminMaintenanceStatus | null>(null);
  const [adminMaintenanceTimestamp, setAdminMaintenanceTimestamp] = useState('');
  const [adminMaintenanceMessage, setAdminMaintenanceMessage] = useState('');
  const [adminBanner, setAdminBannerState] = useState<AdminSystemBannerStatus | null>(null);
  const [adminBannerTitle, setAdminBannerTitle] = useState('');
  const [adminBannerMessage, setAdminBannerMessage] = useState('');
  const [adminBannerSeverity, setAdminBannerSeverity] = useState('info');
  const [adminBannerStartsAt, setAdminBannerStartsAt] = useState('');
  const [adminBannerEndsAt, setAdminBannerEndsAt] = useState('');
  const [adminBannerDismissible, setAdminBannerDismissible] = useState(true);
  const [adminReports, setAdminReports] = useState<any[]>([]);
  const [adminModQueue, setAdminModQueue] = useState<any[]>([]);
  const [adminBans, setAdminBans] = useState<AdminBanRecord[]>([]);
  const [adminBannedWords, setAdminBannedWords] = useState<AdminBannedWordRecord[]>([]);
  const [adminModerationSearchQ, setAdminModerationSearchQ] = useState('');
  const [adminModerationSearchLoading, setAdminModerationSearchLoading] = useState(false);
  const [adminModerationSearchResults, setAdminModerationSearchResults] = useState<Array<{ id: string; username: string }>>([]);
  const [adminBanTargetUserId, setAdminBanTargetUserId] = useState('');
  const [adminBanTargetUsername, setAdminBanTargetUsername] = useState('');
  const [adminBanReason, setAdminBanReason] = useState('');
  const [adminBanPermanent, setAdminBanPermanent] = useState(true);
  const [adminBanExpiresAt, setAdminBanExpiresAt] = useState('');
  const [adminBannedWordPhrase, setAdminBannedWordPhrase] = useState('');
  const [adminBannedWordAction, setAdminBannedWordAction] = useState('warn');
  const [adminBannedWordScope, setAdminBannedWordScope] = useState('global');
  const [adminBannedWordRegex, setAdminBannedWordRegex] = useState(false);

  const connectionHost = useMemo(() => {
    try {
      return new URL(apiBase).host;
    } catch {
      return apiBase.replace(/^https?:\/\//i, '');
    }
  }, [apiBase]);

  const hasStaffWorkspace = useMemo(() => hasStaffAccess(user), [user]);
  const staffRoleLabel = useMemo(() => getRoleLabel(user), [user]);
  const staffSections = useMemo(() => getAvailableStaffSections(user), [user]);

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

  const adminOverviewCards = useMemo(
    () => [
      { label: 'Users', value: String(adminStats?.users ?? 0) },
      { label: 'Online', value: String(adminStats?.online ?? 0) },
      { label: 'Tickets', value: String(adminFeedback.length) },
      { label: 'Health', value: adminHealth?.status || 'unknown' },
    ],
    [adminFeedback.length, adminHealth?.status, adminStats?.online, adminStats?.users]
  );

  const authStepMeta = useMemo(() => {
    if (authStep === 'credentials') {
      return {
        eyebrow: 'Mobile access',
        title: 'Secure device sign in',
        text: 'Use your ID and password to sign in to SafeGram. Registration signs you in right away.',
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
    if (chat.lastMessage?.ciphertext) return 'Protected message';
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
      const archived = Boolean(chat.archivedAt);
      if (showArchivedOnly && !archived) return false;
      if (!showArchivedOnly && archived) return false;
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
  }, [chatSearchQ, chats, getChatCardSubtitle, getChatCardTitle, showArchivedOnly, showStarredOnly, starredChats]);

  const chatsStats = useMemo(() => {
    const active = chats.filter((item) => !item.archivedAt).length;
    const archived = chats.filter((item) => Boolean(item.archivedAt)).length;
    const starred = starredChats.size;
    const dm = chats.filter((item) => item.type === 'dm' && !item.archivedAt).length;
    const groups = chats.filter((item) => item.type !== 'dm' && !item.archivedAt).length;
    return { active, archived, starred, dm, groups };
  }, [chats, starredChats]);

  const selectedServerRole = useMemo(() => {
    if (!selectedServer || !user) return 'member';
    return (
      serverMembers.find((member) => member.userId === user.id)?.role ||
      (selectedServer.ownerId === user.id ? 'owner' : 'member')
    );
  }, [selectedServer, serverMembers, user]);

  const canManageSelectedServer = useMemo(
    () => selectedServerRole === 'owner' || selectedServerRole === 'admin',
    [selectedServerRole]
  );

  const selectedServerTextChannels = useMemo(
    () => serverChannels.filter((channel) => channel.type === 'text').sort((a, b) => a.position - b.position),
    [serverChannels]
  );

  const selectedServerVoiceChannels = useMemo(
    () => serverChannels.filter((channel) => channel.type === 'voice').sort((a, b) => a.position - b.position),
    [serverChannels]
  );

  const selectedServerVoiceChannel = useMemo(
    () => selectedServerVoiceChannels.find((channel) => channel.id === selectedVoiceChannelId) || null,
    [selectedVoiceChannelId, selectedServerVoiceChannels]
  );

  const selectedServerInviteUrl = useMemo(
    () =>
      serverInviteLink
        ? `https://safegram.site/app/servers/join/${serverInviteLink}`
        : '',
    [serverInviteLink]
  );

  const inviteReadyForShare = useMemo(
    () => Boolean(selectedServerInviteUrl && selectedServer),
    [selectedServer, selectedServerInviteUrl]
  );

  const getServerMemberName = useCallback(
    (userId?: string) => {
      if (!userId) return 'Unknown';
      const member = serverMembers.find((item) => item.userId === userId);
      return member?.user?.username || `user:${userId.slice(0, 6)}`;
    },
    [serverMembers]
  );

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

  const clearAdminWorkspace = useCallback(
    async (clearStoredToken = true) => {
      if (clearStoredToken) {
        await clearAdmin2FAToken();
      }
      setAdminTwoFactorToken(null);
      setAdminTwoFactorCode('');
      setAdminStats(null);
      setAdminHealth(null);
      setAdminAnalytics(null);
      setAdminPremium(null);
      setAdminUsers([]);
      setAdminFeedback([]);
      setAdminReports([]);
      setAdminModQueue([]);
      setAdminBans([]);
      setAdminBannedWords([]);
      setAdminModerationSearchQ('');
      setAdminModerationSearchResults([]);
      setAdminBanTargetUserId('');
      setAdminBanTargetUsername('');
      setAdminBanReason('');
      setAdminBanPermanent(true);
      setAdminBanExpiresAt('');
      setAdminBannedWordPhrase('');
      setAdminBannedWordAction('warn');
      setAdminBannedWordScope('global');
      setAdminBannedWordRegex(false);
      setAdminMaintenanceState(null);
      setAdminBannerState(null);
    },
    []
  );

  const handleAdminWorkspaceError = useCallback(
    async (error: any, title = 'Staff tools') => {
      const message = String(error?.message || error || '');
      if (message === 'Staff verification required') {
        await clearAdminWorkspace(true);
        Alert.alert('Staff tools', 'Enter a fresh two-factor code to continue.');
        return true;
      }
      if (message === 'Enable two-factor authentication before opening staff tools') {
        await clearAdminWorkspace(true);
        setAdminTwoFactorEnabled(false);
        Alert.alert('Staff tools', 'Enable 2FA in the desktop or web settings first.');
        return true;
      }
      Alert.alert(title, message || 'Request failed');
      return false;
    },
    [clearAdminWorkspace]
  );

  const loadAdminOverview = useCallback(
    async (staffToken: string) => {
      if (!token || !hasStaffWorkspace) return;

      const overviewTasks: Array<Promise<any>> = [
        getAdminStats(apiBase, token, staffToken),
        getAdminSystemHealth(apiBase, token, staffToken),
        getAdminAnalytics(apiBase, token, staffToken, '7d'),
      ];
      const shouldLoadPremium = hasRoleAtLeast(user, 'billing_manager');
      if (shouldLoadPremium) {
        overviewTasks.push(getAdminPremiumDashboard(apiBase, token, staffToken, '30d'));
      }

      const [stats, health, analytics, premium] = await Promise.all(overviewTasks);
      setAdminStats(stats as AdminStatsSnapshot);
      setAdminHealth(health as AdminSystemHealth);
      setAdminAnalytics(analytics as AdminAnalyticsSummary);
      setAdminPremium(shouldLoadPremium ? ((premium as AdminPremiumDashboard) || null) : null);
    },
    [apiBase, hasStaffWorkspace, token, user]
  );

  const loadAdminSectionData = useCallback(
    async (section: StaffSectionId, staffTokenOverride?: string) => {
      if (!token || !hasStaffWorkspace) return;
      const staffToken = staffTokenOverride || adminTwoFactorToken;
      if (!staffToken) return;

      if (section === 'support') {
        const tickets = await getAdminFeedback(apiBase, token, staffToken, { status: adminFeedbackStatus });
        setAdminFeedback(tickets);
        return;
      }

      if (section === 'moderation') {
        const [reports, queue, bans, bannedWords] = await Promise.all([
          getAdminReports(apiBase, token, staffToken),
          getAdminModQueue(apiBase, token, staffToken),
          getAdminBans(apiBase, token, staffToken),
          getAdminBannedWords(apiBase, token, staffToken),
        ]);
        setAdminReports(reports);
        setAdminModQueue(queue);
        setAdminBans(bans);
        setAdminBannedWords(bannedWords);
        return;
      }

      if (section === 'release') {
        const [maintenance, banner] = await Promise.all([
          getAdminMaintenance(apiBase, token, staffToken),
          getAdminSystemBanner(apiBase, token, staffToken),
        ]);
        setAdminMaintenanceState(maintenance);
        setAdminBannerState(banner);
        setAdminMaintenanceTimestamp(maintenance?.timestamp || '');
        setAdminMaintenanceMessage(maintenance?.message || '');
        setAdminBannerTitle(banner?.title || '');
        setAdminBannerMessage(banner?.message || '');
        setAdminBannerSeverity(banner?.severity || 'info');
        setAdminBannerStartsAt(
          typeof banner?.startsAt === 'string' ? banner.startsAt.slice(0, 16) : ''
        );
        setAdminBannerEndsAt(
          typeof banner?.endsAt === 'string' ? banner.endsAt.slice(0, 16) : ''
        );
        setAdminBannerDismissible(Boolean(banner?.dismissible));
        return;
      }

      if (section === 'sysadmin' || section === 'owner') {
        const usersList = await getAdminUsers(apiBase, token, staffToken, { search: adminUserSearch });
        setAdminUsers(usersList);
        return;
      }

      if (section === 'billing') {
        const premium = await getAdminPremiumDashboard(apiBase, token, staffToken, '30d');
        setAdminPremium(premium);
        return;
      }
    },
    [
      adminFeedbackStatus,
      adminTwoFactorToken,
      adminUserSearch,
      apiBase,
      hasStaffWorkspace,
      token,
    ]
  );

  const enterAdminWorkspace = useCallback(async () => {
    if (!token || !hasStaffWorkspace) {
      Alert.alert('Staff tools', 'This account has no staff role.');
      return;
    }
    setAdminGateLoading(true);
    try {
      const status = await getAdmin2FAStatus(apiBase, token);
      setAdminTwoFactorEnabled(Boolean(status.twoFactorEnabled));
      if (!status.twoFactorEnabled) {
        setView('admin');
        return;
      }
      const stored = adminTwoFactorToken || (await getSavedAdmin2FAToken());
      if (stored) {
        setAdminTwoFactorToken(stored);
        await loadAdminOverview(stored);
        await loadAdminSectionData(getDefaultStaffSection(user), stored);
      }
      setView('admin');
    } catch (error: any) {
      await handleAdminWorkspaceError(error);
      setView('admin');
    } finally {
      setAdminGateLoading(false);
    }
  }, [
    adminTwoFactorToken,
    apiBase,
    handleAdminWorkspaceError,
    hasStaffWorkspace,
    loadAdminOverview,
    loadAdminSectionData,
    token,
    user,
  ]);

  const verifyAdminWorkspace = useCallback(async () => {
    if (!token) return;
    const code = adminTwoFactorCode.trim();
    if (code.length < 6) {
      Alert.alert('Staff verification', 'Enter the current 2FA code.');
      return;
    }
    setAdminGateLoading(true);
    try {
      const result = await verifyAdmin2FA(apiBase, token, code);
      await saveAdmin2FAToken(result.token);
      setAdminTwoFactorToken(result.token);
      setAdminTwoFactorCode('');
      await loadAdminOverview(result.token);
      await loadAdminSectionData(adminSection, result.token);
    } catch (error: any) {
      await handleAdminWorkspaceError(error, 'Staff verification');
    } finally {
      setAdminGateLoading(false);
    }
  }, [
    adminSection,
    adminTwoFactorCode,
    apiBase,
    handleAdminWorkspaceError,
    loadAdminOverview,
    loadAdminSectionData,
    token,
  ]);

  const hydrateSession = useCallback(async () => {
    const [savedToken, savedUserRaw, savedSecureMode, savedStarredChats, savedAdmin2FAToken] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.token),
      AsyncStorage.getItem(STORAGE_KEYS.user),
      AsyncStorage.getItem(STORAGE_KEYS.secureMode),
      AsyncStorage.getItem(STARRED_CHATS_KEY),
      getSavedAdmin2FAToken(),
    ]);
    await AsyncStorage.removeItem(STORAGE_KEYS.apiBase);

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
        setAdminTwoFactorToken(savedAdmin2FAToken || null);
        setAdminSection(getDefaultStaffSection(parsedUser));
        setView('chats');
      } catch {
        await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user, STORAGE_KEYS.admin2FAToken]);
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

  useEffect(() => {
    if (!token || view !== 'admin' || !hasStaffWorkspace || !adminTwoFactorToken) return;
    loadAdminSectionData(adminSection).catch((error) => {
      handleAdminWorkspaceError(error);
    });
  }, [
    adminSection,
    adminTwoFactorToken,
    handleAdminWorkspaceError,
    hasStaffWorkspace,
    loadAdminSectionData,
    token,
    view,
  ]);

  useEffect(() => {
    if (!hasStaffWorkspace) {
      setAdminSection('support');
      return;
    }
    const allowedIds = staffSections.map((section) => section.id);
    if (!allowedIds.includes(adminSection)) {
      setAdminSection(getDefaultStaffSection(user));
    }
  }, [adminSection, hasStaffWorkspace, staffSections, user]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user, STORAGE_KEYS.admin2FAToken]);
    setToken(null);
    setUser(null);
    setPremiumInfo(null);
    setBillingPlans([]);
    setSupportTickets([]);
    setChats([]);
    setSearchResults([]);
    setSelectedChat(null);
    setChatOrigin('chats');
    setMessages([]);
    setComposer('');
    setAttachmentDraft(null);
    setServers([]);
    setServersLoading(false);
    setSelectedServer(null);
    setServerChannels([]);
    setServerCategories([]);
    setServerMembers([]);
    setServerVoiceState({});
    setServerBusy(false);
    setServerDraftName('');
    setServerDraftDescription('');
    setServerJoinCode('');
    setServerSettingsName('');
    setServerSettingsDescription('');
    setServerInviteLink('');
    setChannelDraftName('');
    setChannelDraftType('text');
    setCategoryDraftName('');
    setSelectedVoiceChannelId('');
    setSelectedVoiceRoom(null);
    setServerRoles([]);
    setServerAllPermissions([]);
    setServerHistory([]);
    setServerRoleDraftName('');
    setServerRoleDraftColor('99aab5');
    setServerRoleDraftPermissions([]);
    setEditingServerRoleId('');
    setServerMemberSearchQ('');
    setServerMemberSearchResults([]);
    setPendingEntryServerId('');
    setPendingEntryTextChannelId('');
    setPendingEntryVoiceChannelId('');
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
    setAdminTwoFactorEnabled(false);
    setAdminTwoFactorToken(null);
    setAdminTwoFactorCode('');
    setAdminStats(null);
    setAdminHealth(null);
    setAdminAnalytics(null);
    setAdminPremium(null);
    setAdminUsers([]);
    setAdminFeedback([]);
    setAdminReports([]);
    setAdminModQueue([]);
    setAdminBans([]);
    setAdminBannedWords([]);
    setAdminModerationSearchQ('');
    setAdminModerationSearchResults([]);
    setAdminBanTargetUserId('');
    setAdminBanTargetUsername('');
    setAdminBanReason('');
    setAdminBanPermanent(true);
    setAdminBanExpiresAt('');
    setAdminBannedWordPhrase('');
    setAdminBannedWordAction('warn');
    setAdminBannedWordScope('global');
    setAdminBannedWordRegex(false);
    setAdminMaintenanceState(null);
    setAdminBannerState(null);
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

  const completeLogin = useCallback(async (
    nextToken: string,
    nextUser: AuthUser,
    entry?: {
      entryServerId?: string;
      entryTextChannelId?: string;
      entryVoiceChannelId?: string;
    }
  ) => {
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
    await clearAdminWorkspace(true);
    setAdminTwoFactorEnabled(false);
    setAdminSection(getDefaultStaffSection(hydratedUser));
    setPremiumInfo(null);
    setServers([]);
    setSelectedServer(null);
    setServerJoinCode('');
    setServerSettingsName('');
    setServerSettingsDescription('');
    setServerInviteLink('');
    setServerChannels([]);
    setServerCategories([]);
    setServerMembers([]);
    setServerVoiceState({});
    setSelectedVoiceChannelId('');
    setSelectedVoiceRoom(null);
    setServerRoles([]);
    setServerAllPermissions([]);
    setServerHistory([]);
    setServerRoleDraftName('');
    setServerRoleDraftColor('99aab5');
    setServerRoleDraftPermissions([]);
    setEditingServerRoleId('');
    setServerMemberSearchQ('');
    setServerMemberSearchResults([]);
    setPendingEntryServerId(entry?.entryServerId || '');
    setPendingEntryTextChannelId(entry?.entryTextChannelId || '');
    setPendingEntryVoiceChannelId(entry?.entryVoiceChannelId || '');
    setUsername('');
    setPassword('');
    resetAuthFlow();
    setView(entry?.entryServerId ? 'servers' : 'chats');
  }, [apiBase, clearAdminWorkspace, resetAuthFlow]);

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
      const list = await getChats(apiBase, token, { includeArchived: true });
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

  const loadServersSafe = useCallback(
    async (authToken = token, options: { silent?: boolean } = {}) => {
      if (!authToken) return [] as ServerSummary[];
      if (!options.silent) setServersLoading(true);
      try {
        const list = await getServers(apiBase, authToken);
        setServers(list);
        return list;
      } catch (error: any) {
        if ((error?.message || '').includes('session_invalid')) {
          await logout();
          return [] as ServerSummary[];
        }
        Alert.alert('Servers', String(error?.message || error));
        return [] as ServerSummary[];
      } finally {
        if (!options.silent) setServersLoading(false);
      }
    },
    [apiBase, logout, token]
  );

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
              displayText = decrypted || 'Protected message (unavailable on this device)';
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

  const loadSelectedServerData = useCallback(
    async (
      serverId: string,
      options: {
        authToken?: string | null;
        silent?: boolean;
        preferredVoiceChannelId?: string;
      } = {}
    ) => {
      const authToken = options.authToken ?? token;
      if (!authToken) return null;
      if (!options.silent) setServerBusy(true);
      try {
        const [server, channels, categories, members, voiceState] = await Promise.all([
          getServer(apiBase, authToken, serverId),
          getServerChannels(apiBase, authToken, serverId),
          getServerCategories(apiBase, authToken, serverId),
          getServerMembers(apiBase, authToken, serverId),
          getServerVoiceState(apiBase, authToken, serverId),
        ]);
        setSelectedServer(server);
        setServerSettingsName(server.name || '');
        setServerSettingsDescription(server.description || '');
        setServerInviteLink(server.inviteLink || '');
        setServerChannels(channels);
        setServerCategories(categories);
        setServerMembers(members);
        setServerVoiceState(voiceState);
        try {
          const [rolesPayload, historyItems] = await Promise.all([
            getServerRoles(apiBase, authToken, serverId),
            getServerHistory(apiBase, authToken, serverId),
          ]);
          setServerRoles(rolesPayload.roles || []);
          setServerAllPermissions(rolesPayload.allPermissions || []);
          setServerHistory(historyItems || []);
        } catch {
          setServerRoles([]);
          setServerAllPermissions([]);
          setServerHistory([]);
        }

        const requestedVoiceChannelId = options.preferredVoiceChannelId || selectedVoiceChannelId;
        const nextVoiceChannel =
          (requestedVoiceChannelId
            ? channels.find((channel) => channel.id === requestedVoiceChannelId && channel.type === 'voice')
            : null) ||
          null;

        if (nextVoiceChannel?.chatId) {
          setSelectedVoiceChannelId(nextVoiceChannel.id);
          const room = await getVoiceRoom(apiBase, authToken, nextVoiceChannel.chatId);
          setSelectedVoiceRoom(room);
        } else {
          setSelectedVoiceChannelId('');
          setSelectedVoiceRoom(null);
        }

        return { server, channels, categories, members, voiceState };
      } catch (error: any) {
        if ((error?.message || '').includes('session_invalid')) {
          await logout();
          return null;
        }
        Alert.alert('Server', String(error?.message || error));
        return null;
      } finally {
        if (!options.silent) setServerBusy(false);
      }
    },
    [apiBase, logout, selectedVoiceChannelId, token]
  );

  useEffect(() => {
    if (token && view === 'chats') {
      loadChatsSafe();
    }
  }, [token, view, loadChatsSafe]);

  useEffect(() => {
    if (!token || view !== 'servers') return;
    let cancelled = false;
    (async () => {
      const list = await loadServersSafe(token);
      if (cancelled || !pendingEntryServerId) return;
      const matched = list.find((item) => item.id === pendingEntryServerId) || null;
      if (!matched) {
        setPendingEntryServerId('');
        setPendingEntryTextChannelId('');
        setPendingEntryVoiceChannelId('');
        return;
      }
      setSelectedServer(matched);
      setView('server');
    })();
    return () => {
      cancelled = true;
    };
  }, [loadServersSafe, pendingEntryServerId, token, view]);

  useEffect(() => {
    if (!token || view !== 'server' || !selectedServer?.id) return;
    loadSelectedServerData(selectedServer.id, {
      preferredVoiceChannelId: pendingEntryVoiceChannelId || selectedVoiceChannelId || undefined,
    }).then((payload) => {
      if (!payload) return;
      if (pendingEntryTextChannelId) {
        const entryTextChannel = payload.channels.find(
          (channel) => channel.id === pendingEntryTextChannelId && channel.type === 'text' && channel.chatId
        );
        if (entryTextChannel?.chatId) {
          setPendingEntryTextChannelId('');
          setPendingEntryServerId('');
          setPendingEntryVoiceChannelId('');
          setSelectedChat({
            id: entryTextChannel.chatId,
            type: 'channel',
            name: `${payload.server.name} · #${entryTextChannel.name}`,
          });
          setMessages([]);
          setComposer('');
          setAttachmentDraft(null);
          setChatOrigin('server');
          setView('chat');
        } else {
          setPendingEntryTextChannelId('');
          setPendingEntryServerId('');
          setPendingEntryVoiceChannelId('');
        }
      } else if (pendingEntryServerId) {
        setPendingEntryServerId('');
        setPendingEntryVoiceChannelId('');
      }
    });
    const timer = setInterval(() => {
      loadSelectedServerData(selectedServer.id, {
        silent: true,
        preferredVoiceChannelId: selectedVoiceChannelId || pendingEntryVoiceChannelId || undefined,
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [
    loadSelectedServerData,
    pendingEntryServerId,
    pendingEntryTextChannelId,
    pendingEntryVoiceChannelId,
    selectedServer?.id,
    selectedVoiceChannelId,
    token,
    view,
  ]);

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
        await completeLogin(auth.token, auth.user, auth);
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
      await completeLogin(auth.token, auth.user, auth);
    } catch (error: any) {
      Alert.alert('Register failed', String(error?.message || error));
    } finally {
      setAuthLoading(false);
    }
  }, [apiBase, completeLogin, password, username]);

  const onOpenChat = useCallback(
    async (chat: ChatSummary, origin: ChatOrigin = 'chats') => {
      setSelectedChat(chat);
      setChatOrigin(origin);
      setMessages([]);
      setComposer('');
      setAttachmentDraft(null);
      setView('chat');
      await loadMessagesSafe(chat.id, true);
    },
    [loadMessagesSafe]
  );

  const openServer = useCallback(
    async (
      server: ServerSummary,
      options: {
        preferredTextChannelId?: string;
        preferredVoiceChannelId?: string;
      } = {}
    ) => {
      setServerMemberSearchQ('');
      setServerMemberSearchResults([]);
      setSelectedServer(server);
      setView('server');
      const payload = await loadSelectedServerData(server.id, {
        preferredVoiceChannelId: options.preferredVoiceChannelId,
      });
      if (!payload) return;
      if (options.preferredTextChannelId) {
        const targetChannel = payload.channels.find(
          (channel) =>
            channel.id === options.preferredTextChannelId &&
            channel.type === 'text' &&
            typeof channel.chatId === 'string' &&
            channel.chatId
        );
        if (targetChannel?.chatId) {
          await onOpenChat(
            {
              id: targetChannel.chatId,
              type: 'channel',
              name: `${payload.server.name} · #${targetChannel.name}`,
            },
            'server'
          );
        }
      }
    },
    [loadSelectedServerData, onOpenChat]
  );

  const onCreateServer = useCallback(async () => {
    if (!token) return;
    const name = serverDraftName.trim();
    const description = serverDraftDescription.trim();
    if (name.length < 2) {
      Alert.alert('Server', 'Enter server name.');
      return;
    }
    setServerBusy(true);
    try {
      const server = await createServer(apiBase, token, {
        name,
        description: description || undefined,
      });
      setServerDraftName('');
      setServerDraftDescription('');
      await loadServersSafe(token, { silent: true });
      await openServer(server);
    } catch (error: any) {
      Alert.alert('Server', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [apiBase, loadServersSafe, openServer, serverDraftDescription, serverDraftName, token]);

  const onCreateServerCategory = useCallback(async () => {
    if (!token || !selectedServer) return;
    const name = categoryDraftName.trim();
    if (!name) {
      Alert.alert('Category', 'Enter category name.');
      return;
    }
    setServerBusy(true);
    try {
      await createServerCategory(apiBase, token, selectedServer.id, {
        name,
        position: serverCategories.length,
      });
      setCategoryDraftName('');
      await loadSelectedServerData(selectedServer.id, { authToken: token });
    } catch (error: any) {
      Alert.alert('Category', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [apiBase, categoryDraftName, loadSelectedServerData, selectedServer, serverCategories.length, token]);

  const onCreateServerChannel = useCallback(async () => {
    if (!token || !selectedServer) return;
    const name = channelDraftName.trim();
    if (!name) {
      Alert.alert('Channel', 'Enter channel name.');
      return;
    }
    setServerBusy(true);
    try {
      await createServerChannel(apiBase, token, selectedServer.id, {
        name,
        type: channelDraftType,
        position: serverChannels.length,
      });
      setChannelDraftName('');
      setChannelDraftType('text');
      await loadSelectedServerData(selectedServer.id, { authToken: token });
    } catch (error: any) {
      Alert.alert('Channel', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [apiBase, channelDraftName, channelDraftType, loadSelectedServerData, selectedServer, serverChannels.length, token]);

  const onDeleteServerChannel = useCallback(
    (channel: ServerChannel) => {
      if (!token || !selectedServer) return;
      Alert.alert('Channel', `Delete ${channel.type === 'voice' ? 'voice' : 'text'} channel "${channel.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setServerBusy(true);
            try {
              await deleteServerChannel(apiBase, token, selectedServer.id, channel.id);
              await loadSelectedServerData(selectedServer.id, { authToken: token });
            } catch (error: any) {
              Alert.alert('Channel', String(error?.message || error));
            } finally {
              setServerBusy(false);
            }
          },
        },
      ]);
    },
    [apiBase, loadSelectedServerData, selectedServer, token]
  );

  const onOpenServerTextChannel = useCallback(
    async (channel: ServerChannel) => {
      if (!channel.chatId || !selectedServer) return;
      await onOpenChat(
        {
          id: channel.chatId,
          type: 'channel',
          name: `${selectedServer.name} · #${channel.name}`,
        },
        'server'
      );
    },
    [onOpenChat, selectedServer]
  );

  const onSelectServerVoiceChannel = useCallback(
    async (channel: ServerChannel) => {
      if (!token || !channel.chatId) return;
      setSelectedVoiceChannelId(channel.id);
      try {
        const room = await getVoiceRoom(apiBase, token, channel.chatId);
        setSelectedVoiceRoom(room);
      } catch (error: any) {
        Alert.alert('Voice', String(error?.message || error));
      }
    },
    [apiBase, token]
  );

  const onStartVoiceRoom = useCallback(
    async (channel: ServerChannel) => {
      if (!token || !channel.chatId) return;
      setServerBusy(true);
      try {
        const room = await createVoiceRoom(apiBase, token, channel.chatId);
        setSelectedVoiceChannelId(channel.id);
        setSelectedVoiceRoom(room);
        if (selectedServer) {
          await loadSelectedServerData(selectedServer.id, { authToken: token, preferredVoiceChannelId: channel.id });
        }
      } catch (error: any) {
        Alert.alert('Voice', String(error?.message || error));
      } finally {
        setServerBusy(false);
      }
    },
    [apiBase, loadSelectedServerData, selectedServer, token]
  );

  const onEndVoiceRoom = useCallback(async () => {
    if (!token || !selectedServer || !selectedVoiceRoom) return;
    setServerBusy(true);
    try {
      await endVoiceRoom(apiBase, token, selectedVoiceRoom.id);
      setSelectedVoiceRoom(null);
      await loadSelectedServerData(selectedServer.id, { authToken: token, preferredVoiceChannelId: selectedVoiceChannelId || undefined });
    } catch (error: any) {
      Alert.alert('Voice', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [apiBase, loadSelectedServerData, selectedServer, selectedVoiceChannelId, selectedVoiceRoom, token]);

  const onLeaveSelectedServer = useCallback(() => {
    if (!token || !selectedServer) return;
    Alert.alert('Server', `Leave "${selectedServer.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setServerBusy(true);
          try {
            await leaveServer(apiBase, token, selectedServer.id);
            setSelectedServer(null);
            setServerChannels([]);
            setServerCategories([]);
            setServerMembers([]);
            setServerVoiceState({});
            setSelectedVoiceChannelId('');
            setSelectedVoiceRoom(null);
            setServerMemberSearchQ('');
            setServerMemberSearchResults([]);
            setView('servers');
            await loadServersSafe(token, { silent: true });
          } catch (error: any) {
            Alert.alert('Server', String(error?.message || error));
          } finally {
            setServerBusy(false);
          }
        },
      },
    ]);
  }, [apiBase, loadServersSafe, selectedServer, token]);

  const onJoinServerByCode = useCallback(async () => {
    if (!token) return;
    const invite = serverJoinCode.trim();
    if (!invite) {
      Alert.alert('Server invite', 'Enter an invite code or full join URL.');
      return;
    }
    const normalized = invite.replace(/^https?:\/\/[^/]+\/app\/servers\/join\//i, '').trim();
    setServerBusy(true);
    try {
      const result = await joinServerByInvite(apiBase, token, normalized);
      setServerJoinCode('');
      const refreshed = await loadServersSafe(token, { silent: true });
      const server = result.server || refreshed.find((item) => item.inviteLink === normalized) || null;
      if (server) {
        await openServer(server);
      } else {
        setView('servers');
      }
    } catch (error: any) {
      Alert.alert('Server invite', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [apiBase, loadServersSafe, openServer, serverJoinCode, token]);

  const onUpdateSelectedServer = useCallback(async () => {
    if (!token || !selectedServer) return;
    const name = serverSettingsName.trim();
    const description = serverSettingsDescription.trim();
    if (name.length < 2) {
      Alert.alert('Server', 'Enter a valid server name.');
      return;
    }
    setServerBusy(true);
    try {
      const updated = await updateServer(apiBase, token, selectedServer.id, {
        name,
        description,
      });
      setSelectedServer(updated);
      await loadServersSafe(token, { silent: true });
      await loadSelectedServerData(updated.id, { authToken: token, preferredVoiceChannelId: selectedVoiceChannelId || undefined });
      Alert.alert('Server', 'Server settings updated.');
    } catch (error: any) {
      Alert.alert('Server', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [apiBase, loadSelectedServerData, loadServersSafe, selectedServer, selectedVoiceChannelId, serverSettingsDescription, serverSettingsName, token]);

  const onRotateServerInvite = useCallback(async () => {
    if (!token || !selectedServer) return;
    setServerBusy(true);
    try {
      const result = await generateServerInviteLink(apiBase, token, selectedServer.id);
      const nextInvite = result.inviteLink || '';
      setServerInviteLink(nextInvite);
      setSelectedServer((prev) => (prev ? { ...prev, inviteLink: nextInvite } : prev));
      await loadServersSafe(token, { silent: true });
    } catch (error: any) {
      Alert.alert('Invite', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [apiBase, loadServersSafe, selectedServer, token]);

  const onShareSelectedServerInvite = useCallback(async () => {
    if (!selectedServer || !selectedServerInviteUrl) {
      Alert.alert('Invite', 'Generate an invite link first.');
      return;
    }
    try {
      await Share.share({
        title: `Join ${selectedServer.name} on SafeGram`,
        message: `Join ${selectedServer.name} on SafeGram:\n${selectedServerInviteUrl}`,
        url: selectedServerInviteUrl,
      });
    } catch (error: any) {
      Alert.alert('Invite', String(error?.message || error));
    }
  }, [selectedServer, selectedServerInviteUrl]);

  const onDeleteServerCategory = useCallback(
    (category: ServerCategory) => {
      if (!token || !selectedServer) return;
      Alert.alert('Category', `Delete category "${category.name}"? Channels inside it will become uncategorized.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setServerBusy(true);
            try {
              await deleteServerCategory(apiBase, token, selectedServer.id, category.id);
              await loadSelectedServerData(selectedServer.id, {
                authToken: token,
                preferredVoiceChannelId: selectedVoiceChannelId || undefined,
              });
            } catch (error: any) {
              Alert.alert('Category', String(error?.message || error));
            } finally {
              setServerBusy(false);
            }
          },
        },
      ]);
    },
    [apiBase, loadSelectedServerData, selectedServer, selectedVoiceChannelId, token]
  );

  const onMoveServerChannelToCategory = useCallback(
    async (channel: ServerChannel, categoryId?: string) => {
      if (!token || !selectedServer) return;
      setServerBusy(true);
      try {
        await setServerChannelCategory(apiBase, token, selectedServer.id, channel.id, categoryId);
        await loadSelectedServerData(selectedServer.id, {
          authToken: token,
          preferredVoiceChannelId: channel.type === 'voice' ? channel.id : selectedVoiceChannelId || undefined,
        });
      } catch (error: any) {
        Alert.alert('Channel', String(error?.message || error));
      } finally {
        setServerBusy(false);
      }
    },
    [apiBase, loadSelectedServerData, selectedServer, selectedVoiceChannelId, token]
  );

  const onFindServerMembersToAdd = useCallback(async () => {
    if (!token || !selectedServer) return;
    if (serverMemberSearchQ.trim().length < 2) {
      Alert.alert('Members', 'Enter at least 2 chars');
      return;
    }
    setServerMemberSearchLoading(true);
    try {
      const users = await searchUsers(apiBase, token, serverMemberSearchQ.trim());
      const existingIds = new Set(serverMembers.map((member) => member.userId));
      setServerMemberSearchResults(
        users.filter((item) => item.id !== user?.id && !existingIds.has(item.id))
      );
    } catch (error: any) {
      Alert.alert('Members', String(error?.message || error));
    } finally {
      setServerMemberSearchLoading(false);
    }
  }, [apiBase, selectedServer, serverMemberSearchQ, serverMembers, token, user?.id]);

  const onAddServerMember = useCallback(
    async (targetUserId: string) => {
      if (!token || !selectedServer) return;
      setServerBusy(true);
      try {
        const result = await addServerMembersBulk(apiBase, token, selectedServer.id, [targetUserId]);
        await loadSelectedServerData(selectedServer.id, {
          authToken: token,
          preferredVoiceChannelId: selectedVoiceChannelId || undefined,
        });
        setServerMemberSearchResults((current) => current.filter((item) => item.id !== targetUserId));
        Alert.alert('Members', result.added ? 'Member added to server.' : 'User is already in this server.');
      } catch (error: any) {
        Alert.alert('Members', String(error?.message || error));
      } finally {
        setServerBusy(false);
      }
    },
    [apiBase, loadSelectedServerData, selectedServer, selectedVoiceChannelId, token]
  );

  const onSetSelectedServerMemberRole = useCallback(
    async (target: ServerMemberRecord, role: 'owner' | 'admin' | 'moderator' | 'member') => {
      if (!token || !selectedServer) return;
      setServerBusy(true);
      try {
        await setServerMemberRole(apiBase, token, selectedServer.id, target.userId, role);
        await loadSelectedServerData(selectedServer.id, { authToken: token, preferredVoiceChannelId: selectedVoiceChannelId || undefined });
      } catch (error: any) {
        Alert.alert('Role', String(error?.message || error));
      } finally {
        setServerBusy(false);
      }
    },
    [apiBase, loadSelectedServerData, selectedServer, selectedVoiceChannelId, token]
  );

  const onToggleServerRolePermission = useCallback((permission: string) => {
    setServerRoleDraftPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }, []);

  const onStartEditServerRole = useCallback((role: ServerRoleRecord) => {
    setEditingServerRoleId(role.id);
    setServerRoleDraftName(role.name || '');
    setServerRoleDraftColor((role.color || '99aab5').replace(/^#/, ''));
    setServerRoleDraftPermissions(role.permissions || []);
  }, []);

  const onResetServerRoleDraft = useCallback(() => {
    setEditingServerRoleId('');
    setServerRoleDraftName('');
    setServerRoleDraftColor('99aab5');
    setServerRoleDraftPermissions([]);
  }, []);

  const onSaveServerRole = useCallback(async () => {
    if (!token || !selectedServer) return;
    const name = serverRoleDraftName.trim();
    const color = serverRoleDraftColor.trim().replace(/^#/, '');
    if (!name) {
      Alert.alert('Role', 'Enter role name.');
      return;
    }
    setServerBusy(true);
    try {
      if (editingServerRoleId) {
        await updateServerRole(apiBase, token, selectedServer.id, editingServerRoleId, {
          name,
          color,
          permissions: serverRoleDraftPermissions,
        });
      } else {
        await createServerRole(apiBase, token, selectedServer.id, {
          name,
          color,
          permissions: serverRoleDraftPermissions,
        });
      }
      onResetServerRoleDraft();
      await loadSelectedServerData(selectedServer.id, { authToken: token, preferredVoiceChannelId: selectedVoiceChannelId || undefined });
    } catch (error: any) {
      Alert.alert('Role', String(error?.message || error));
    } finally {
      setServerBusy(false);
    }
  }, [
    apiBase,
    createServerRole,
    editingServerRoleId,
    loadSelectedServerData,
    onResetServerRoleDraft,
    selectedServer,
    selectedVoiceChannelId,
    serverRoleDraftColor,
    serverRoleDraftName,
    serverRoleDraftPermissions,
    token,
    updateServerRole,
  ]);

  const onDeleteSelectedServerRole = useCallback(
    (role: ServerRoleRecord) => {
      if (!token || !selectedServer) return;
      Alert.alert('Role', `Delete role "${role.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setServerBusy(true);
            try {
              await deleteServerRole(apiBase, token, selectedServer.id, role.id);
              if (editingServerRoleId === role.id) {
                onResetServerRoleDraft();
              }
              await loadSelectedServerData(selectedServer.id, { authToken: token, preferredVoiceChannelId: selectedVoiceChannelId || undefined });
            } catch (error: any) {
              Alert.alert('Role', String(error?.message || error));
            } finally {
              setServerBusy(false);
            }
          },
        },
      ]);
    },
    [apiBase, deleteServerRole, editingServerRoleId, loadSelectedServerData, onResetServerRoleDraft, selectedServer, selectedVoiceChannelId, token]
  );

  const onToggleServerMemberCustomRole = useCallback(
    async (member: ServerMemberRecord, roleId: string) => {
      if (!token || !selectedServer) return;
      const currentIds = (member.roles || []).map((role) => role.id).filter((value): value is string => Boolean(value));
      const nextIds = currentIds.includes(roleId)
        ? currentIds.filter((item) => item !== roleId)
        : [...currentIds, roleId];
      setServerBusy(true);
      try {
        await setServerMemberRoles(apiBase, token, selectedServer.id, member.userId, nextIds);
        await loadSelectedServerData(selectedServer.id, { authToken: token, preferredVoiceChannelId: selectedVoiceChannelId || undefined });
      } catch (error: any) {
        Alert.alert('Role', String(error?.message || error));
      } finally {
        setServerBusy(false);
      }
    },
    [apiBase, loadSelectedServerData, selectedServer, selectedVoiceChannelId, token]
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

  const onDeleteChat = useCallback(
    (chat: ChatSummary) => {
      if (!token) return;
      const title = getChatCardTitle(chat);
      Alert.alert('Delete chat', `Delete "${title}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChatRequest(apiBase, token, chat.id);
              if (selectedChat?.id === chat.id) {
                setSelectedChat(null);
                setMessages([]);
                setAttachmentDraft(null);
                setView('chats');
              }
              await loadChatsSafe();
              Alert.alert('Delete chat', 'Chat removed.');
            } catch (error: any) {
              Alert.alert('Delete chat', String(error?.message || error));
            }
          },
        },
      ]);
    },
    [apiBase, getChatCardTitle, loadChatsSafe, selectedChat?.id, token]
  );

  const onToggleArchiveChat = useCallback(
    (chat: ChatSummary) => {
      if (!token) return;
      const archived = Boolean(chat.archivedAt);
      const title = getChatCardTitle(chat);
      Alert.alert(
        archived ? 'Restore chat' : 'Archive chat',
        archived
          ? `Return "${title}" to the main list?`
          : `Move "${title}" to archive? You can restore it later.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: archived ? 'Restore' : 'Archive',
            onPress: async () => {
              try {
                if (archived) {
                  await unarchiveChatRequest(apiBase, token, chat.id);
                } else {
                  await archiveChatRequest(apiBase, token, chat.id);
                }
                if (!archived && selectedChat?.id === chat.id && !showArchivedOnly) {
                  setSelectedChat(null);
                  setMessages([]);
                  setAttachmentDraft(null);
                  setView('chats');
                }
                await loadChatsSafe();
                Alert.alert(archived ? 'Restore chat' : 'Archive chat', archived ? 'Chat restored.' : 'Chat archived.');
              } catch (error: any) {
                Alert.alert(archived ? 'Restore chat' : 'Archive chat', String(error?.message || error));
              }
            },
          },
        ]
      );
    },
    [apiBase, getChatCardTitle, loadChatsSafe, selectedChat?.id, showArchivedOnly, token]
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
          const refreshed = await getChats(apiBase, token, { includeArchived: true });
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
          ? 'Ticket created. Replies will arrive in Support.'
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

  const onRefreshAdminOverview = useCallback(async () => {
    if (!token || !adminTwoFactorToken) return;
    setAdminGateLoading(true);
    try {
      await loadAdminOverview(adminTwoFactorToken);
      await loadAdminSectionData(adminSection, adminTwoFactorToken);
    } catch (error: any) {
      await handleAdminWorkspaceError(error);
    } finally {
      setAdminGateLoading(false);
    }
  }, [adminSection, adminTwoFactorToken, handleAdminWorkspaceError, loadAdminOverview, loadAdminSectionData, token]);

  const onPatchAdminTicketStatus = useCallback(
    async (ticketId: string, status: string) => {
      if (!token || !adminTwoFactorToken) return;
      try {
        await patchAdminFeedback(apiBase, token, adminTwoFactorToken, ticketId, status);
        await loadAdminSectionData('support', adminTwoFactorToken);
      } catch (error: any) {
        await handleAdminWorkspaceError(error, 'Support queue');
      }
    },
    [adminTwoFactorToken, apiBase, handleAdminWorkspaceError, loadAdminSectionData, token]
  );

  const onFindModerationUser = useCallback(async () => {
    if (!token) return;
    if (adminModerationSearchQ.trim().length < 2) {
      Alert.alert('Moderation', 'Enter at least 2 chars');
      return;
    }
    setAdminModerationSearchLoading(true);
    try {
      const users = await searchUsers(apiBase, token, adminModerationSearchQ.trim());
      setAdminModerationSearchResults(users.slice(0, 10));
    } catch (error: any) {
      Alert.alert('Moderation', String(error?.message || error));
    } finally {
      setAdminModerationSearchLoading(false);
    }
  }, [adminModerationSearchQ, apiBase, token]);

  const onCreateAdminBan = useCallback(async () => {
    if (!token || !adminTwoFactorToken) return;
    if (!adminBanTargetUserId) {
      Alert.alert('Ban', 'Choose a user first.');
      return;
    }
    setAdminGateLoading(true);
    try {
      const payload: {
        userId: string;
        reason?: string;
        permanent?: boolean;
        expiresAt?: number;
      } = {
        userId: adminBanTargetUserId,
        reason: adminBanReason.trim() || undefined,
        permanent: adminBanPermanent,
      };
      if (!adminBanPermanent && adminBanExpiresAt.trim()) {
        const parsed = new Date(adminBanExpiresAt.trim());
        if (Number.isNaN(parsed.getTime())) {
          throw new Error('Invalid expiry date');
        }
        payload.expiresAt = parsed.getTime();
      }
      await createAdminBan(apiBase, token, adminTwoFactorToken, payload);
      setAdminBanReason('');
      setAdminBanExpiresAt('');
      await loadAdminSectionData('moderation', adminTwoFactorToken);
      Alert.alert('Ban', 'User banned.');
    } catch (error: any) {
      await handleAdminWorkspaceError(error, 'Ban');
    } finally {
      setAdminGateLoading(false);
    }
  }, [
    adminBanExpiresAt,
    adminBanPermanent,
    adminBanReason,
    adminBanTargetUserId,
    adminTwoFactorToken,
    apiBase,
    handleAdminWorkspaceError,
    loadAdminSectionData,
    token,
  ]);

  const onRevokeAdminBan = useCallback(
    async (banIdOrUserId: string) => {
      if (!token || !adminTwoFactorToken) return;
      setAdminGateLoading(true);
      try {
        await deleteAdminBan(apiBase, token, adminTwoFactorToken, banIdOrUserId);
        await loadAdminSectionData('moderation', adminTwoFactorToken);
      } catch (error: any) {
        await handleAdminWorkspaceError(error, 'Ban');
      } finally {
        setAdminGateLoading(false);
      }
    },
    [adminTwoFactorToken, apiBase, handleAdminWorkspaceError, loadAdminSectionData, token]
  );

  const onCreateAdminBannedWord = useCallback(async () => {
    if (!token || !adminTwoFactorToken) return;
    const phrase = adminBannedWordPhrase.trim();
    if (!phrase) {
      Alert.alert('Banned words', 'Enter a phrase.');
      return;
    }
    setAdminGateLoading(true);
    try {
      await createAdminBannedWord(apiBase, token, adminTwoFactorToken, {
        phrase,
        isRegex: adminBannedWordRegex,
        action: adminBannedWordAction,
        scope: adminBannedWordScope,
      });
      setAdminBannedWordPhrase('');
      setAdminBannedWordRegex(false);
      await loadAdminSectionData('moderation', adminTwoFactorToken);
      Alert.alert('Banned words', 'Rule added.');
    } catch (error: any) {
      await handleAdminWorkspaceError(error, 'Banned words');
    } finally {
      setAdminGateLoading(false);
    }
  }, [
    adminBannedWordAction,
    adminBannedWordPhrase,
    adminBannedWordRegex,
    adminBannedWordScope,
    adminTwoFactorToken,
    apiBase,
    handleAdminWorkspaceError,
    loadAdminSectionData,
    token,
  ]);

  const onToggleAdminBannedWordActive = useCallback(
    async (item: AdminBannedWordRecord) => {
      if (!token || !adminTwoFactorToken) return;
      setAdminGateLoading(true);
      try {
        await patchAdminBannedWord(apiBase, token, adminTwoFactorToken, item.id, {
          active: !item.active,
        });
        await loadAdminSectionData('moderation', adminTwoFactorToken);
      } catch (error: any) {
        await handleAdminWorkspaceError(error, 'Banned words');
      } finally {
        setAdminGateLoading(false);
      }
    },
    [adminTwoFactorToken, apiBase, handleAdminWorkspaceError, loadAdminSectionData, token]
  );

  const onDeleteAdminBannedWord = useCallback(
    async (itemId: string) => {
      if (!token || !adminTwoFactorToken) return;
      setAdminGateLoading(true);
      try {
        await deleteAdminBannedWord(apiBase, token, adminTwoFactorToken, itemId);
        await loadAdminSectionData('moderation', adminTwoFactorToken);
      } catch (error: any) {
        await handleAdminWorkspaceError(error, 'Banned words');
      } finally {
        setAdminGateLoading(false);
      }
    },
    [adminTwoFactorToken, apiBase, handleAdminWorkspaceError, loadAdminSectionData, token]
  );

  const onSaveAdminMaintenance = useCallback(async () => {
    if (!token || !adminTwoFactorToken) return;
    const timestamp = adminMaintenanceTimestamp.trim();
    const message = adminMaintenanceMessage.trim();
    if (!timestamp || !message) {
      Alert.alert('Maintenance', 'Enter start time and message.');
      return;
    }
    setAdminGateLoading(true);
    try {
      await setAdminMaintenance(apiBase, token, adminTwoFactorToken, {
        timestamp,
        message,
        sendEmail: false,
      });
      await loadAdminSectionData('release', adminTwoFactorToken);
      Alert.alert('Maintenance', 'Maintenance banner updated.');
    } catch (error: any) {
      await handleAdminWorkspaceError(error, 'Maintenance');
    } finally {
      setAdminGateLoading(false);
    }
  }, [
    adminMaintenanceMessage,
    adminMaintenanceTimestamp,
    adminTwoFactorToken,
    apiBase,
    handleAdminWorkspaceError,
    loadAdminSectionData,
    token,
  ]);

  const onDisableMaintenance = useCallback(async () => {
    if (!token || !adminTwoFactorToken) return;
    setAdminGateLoading(true);
    try {
      await disableAdminMaintenance(apiBase, token, adminTwoFactorToken);
      await loadAdminSectionData('release', adminTwoFactorToken);
    } catch (error: any) {
      await handleAdminWorkspaceError(error, 'Maintenance');
    } finally {
      setAdminGateLoading(false);
    }
  }, [adminTwoFactorToken, apiBase, handleAdminWorkspaceError, loadAdminSectionData, token]);

  const onSaveAdminBanner = useCallback(async () => {
    if (!token || !adminTwoFactorToken) return;
    const message = adminBannerMessage.trim();
    if (!message) {
      Alert.alert('System banner', 'Enter banner message.');
      return;
    }
    setAdminGateLoading(true);
    try {
      await setAdminSystemBanner(apiBase, token, adminTwoFactorToken, {
        title: adminBannerTitle.trim() || undefined,
        message,
        severity: adminBannerSeverity,
        dismissible: adminBannerDismissible,
        startsAt: adminBannerStartsAt.trim() || undefined,
        endsAt: adminBannerEndsAt.trim() || undefined,
      });
      await loadAdminSectionData('release', adminTwoFactorToken);
      Alert.alert('System banner', 'System banner updated.');
    } catch (error: any) {
      await handleAdminWorkspaceError(error, 'System banner');
    } finally {
      setAdminGateLoading(false);
    }
  }, [
    adminBannerDismissible,
    adminBannerEndsAt,
    adminBannerMessage,
    adminBannerSeverity,
    adminBannerStartsAt,
    adminBannerTitle,
    adminTwoFactorToken,
    apiBase,
    handleAdminWorkspaceError,
    loadAdminSectionData,
    token,
  ]);

  const onDisableAdminBanner = useCallback(async () => {
    if (!token || !adminTwoFactorToken) return;
    setAdminGateLoading(true);
    try {
      await disableAdminSystemBanner(apiBase, token, adminTwoFactorToken);
      await loadAdminSectionData('release', adminTwoFactorToken);
    } catch (error: any) {
      await handleAdminWorkspaceError(error, 'System banner');
    } finally {
      setAdminGateLoading(false);
    }
  }, [adminTwoFactorToken, apiBase, handleAdminWorkspaceError, loadAdminSectionData, token]);

  const runAdminUserAction = useCallback(
    async (action: 'block' | 'unblock' | 'suspend' | 'unsuspend', target: AdminUserRecord) => {
      if (!token || !adminTwoFactorToken) return;
      const title = target.username || target.id.slice(0, 8);
      const question =
        action === 'block'
          ? `Block @${title}?`
          : action === 'unblock'
          ? `Unblock @${title}?`
          : action === 'suspend'
          ? `Suspend @${title}?`
          : `Remove suspension for @${title}?`;
      Alert.alert('User action', question, [
        { text: 'Cancel', style: 'cancel' },
        {
          text:
            action === 'block'
              ? 'Block'
              : action === 'unblock'
              ? 'Unblock'
              : action === 'suspend'
              ? 'Suspend'
              : 'Restore',
          style: action === 'block' || action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            setAdminGateLoading(true);
            try {
              if (action === 'block') await blockAdminUser(apiBase, token, adminTwoFactorToken, target.id);
              if (action === 'unblock') await unblockAdminUser(apiBase, token, adminTwoFactorToken, target.id);
              if (action === 'suspend') await suspendAdminUser(apiBase, token, adminTwoFactorToken, target.id);
              if (action === 'unsuspend') await unsuspendAdminUser(apiBase, token, adminTwoFactorToken, target.id);
              await loadAdminSectionData('sysadmin', adminTwoFactorToken);
            } catch (error: any) {
              await handleAdminWorkspaceError(error, 'User action');
            } finally {
              setAdminGateLoading(false);
            }
          },
        },
      ]);
    },
    [adminTwoFactorToken, apiBase, handleAdminWorkspaceError, loadAdminSectionData, token]
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
      const list = await getChats(apiBase, token, { includeArchived: true });
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
            <Image source={BRAND_MARK} style={styles.bootLogo} />
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
            <View style={styles.brandLockup}>
              <Image source={BRAND_MARK} style={styles.brandMark} />
              <Text style={styles.brandWordmark}>SafeGram</Text>
            </View>
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
                <Text style={styles.sectionSubtitle}>This public mobile build uses the managed SafeGram cluster.</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{connectionHost}</Text>
              </View>
            </View>

            <View style={styles.adminInfoCard}>
              <Text style={styles.adminInfoTitle}>Primary endpoint</Text>
              <Text style={styles.serverAddressText}>{apiBase}</Text>
              <Text style={styles.adminInfoBody}>
                Manual API switching is disabled. Server routing changes are delivered through signed app updates only.
              </Text>
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Account access</Text>
            <Text style={styles.sectionSubtitle}>Sign in with your account details. Additional verification may be requested when needed.</Text>

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
              <Text style={styles.featureText}>Protected messages on this device.</Text>
            </GlassCard>
            <GlassCard style={styles.featureCard}>
              <Text style={styles.featureKicker}>Secure sync</Text>
              <Text style={styles.featureText}>Your chats stay in sync.</Text>
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
                  <Text style={styles.cardTitle}>{user ? `@${user.username}` : 'SafeGram'}</Text>
                  <Text style={styles.cardSubtitle}>{connectionHost}</Text>
                </View>
              </View>
              <Pressable style={styles.ghostPill} onPress={() => setView('chats')}>
                <Text style={styles.ghostPillText}>Back</Text>
              </Pressable>
            </View>
            {hasStaffWorkspace ? (
              <View style={styles.staffEntryRow}>
                <View style={[styles.statusPill, styles.statusPillSecure]}>
                  <Text style={styles.statusPillText}>{staffRoleLabel}</Text>
                </View>
                <Pressable style={styles.primaryButtonCompact} onPress={enterAdminWorkspace}>
                  <Text style={styles.primaryButtonText}>Staff workspace</Text>
                </Pressable>
              </View>
            ) : null}
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Workspace</Text>
            <Text style={styles.sectionSubtitle}>Jump between inbox, servers, support, and staff tools from one device shell.</Text>
            <View style={styles.primaryActionsRow}>
              <Pressable style={styles.secondaryButtonWide} onPress={() => setView('chats')}>
                <Text style={styles.secondaryButtonText}>Open inbox</Text>
              </Pressable>
              <Pressable style={styles.secondaryButtonWide} onPress={() => setView('servers')}>
                <Text style={styles.secondaryButtonText}>Open servers</Text>
              </Pressable>
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Connection</Text>
            <Text style={styles.sectionSubtitle}>This device stays on the managed SafeGram API cluster.</Text>
            <View style={styles.adminInfoCard}>
              <Text style={styles.adminInfoTitle}>Current endpoint</Text>
              <Text style={styles.serverAddressText}>{apiBase}</Text>
              <Text style={styles.adminInfoBody}>
                Public mobile clients cannot edit backend routing from the UI. Endpoint changes ship through release builds only.
              </Text>
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Security defaults</Text>
            <Text style={styles.sectionSubtitle}>This switch changes the default send mode for the composer.</Text>
            <View style={styles.toggleRowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Secure mode</Text>
                <Text style={styles.toggleText}>When enabled, messages are sent in protected mode on this device.</Text>
              </View>
              <Switch value={secureMode} onValueChange={onToggleSecureMode} />
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Premium</Text>
            <Text style={styles.sectionSubtitle}>Subscription status for this account.</Text>

            <View style={styles.pillRowWrap}>
              <View style={[styles.statusPill, premiumInfo?.isPremium ? styles.statusPillSecure : styles.statusPillPlain]}>
                <Text style={styles.statusPillText}>{premiumInfo?.isPremium ? 'Premium active' : 'Free plan'}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{premiumInfo?.isPremium ? 'Premium active' : 'Subscription'}</Text>
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
            <Text style={styles.sectionSubtitle}>Create a ticket and continue the conversation in Support.</Text>

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
                <Text style={styles.secondaryButtonText}>Open support page</Text>
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

  if (view === 'admin') {
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
                  <Text style={styles.eyebrow}>Staff workspace</Text>
                  <Text style={styles.cardTitle}>{staffRoleLabel || 'SafeGram staff'}</Text>
                  <Text style={styles.cardSubtitle}>{connectionHost}</Text>
                </View>
              </View>
              <Pressable style={styles.ghostPill} onPress={() => setView('settings')}>
                <Text style={styles.ghostPillText}>Back</Text>
              </Pressable>
            </View>

            <View style={styles.staffEntryRow}>
              <View style={[styles.statusPill, styles.statusPillSecure]}>
                <Text style={styles.statusPillText}>{adminTwoFactorToken ? 'Verified' : adminTwoFactorEnabled ? '2FA required' : '2FA missing'}</Text>
              </View>
              <Pressable style={styles.secondaryButtonCompact} onPress={onRefreshAdminOverview}>
                <Text style={styles.secondaryButtonText}>Refresh</Text>
              </Pressable>
            </View>

            {staffSections.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {staffSections.map((section) => (
                  <Pressable
                    key={section.id}
                    style={[styles.choiceChip, adminSection === section.id ? styles.choiceChipActive : null]}
                    onPress={() => setAdminSection(section.id)}
                  >
                    <Text style={[styles.choiceChipText, adminSection === section.id ? styles.choiceChipTextActive : null]}>
                      {section.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </GlassCard>

          {adminGateLoading ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}

          {!adminTwoFactorEnabled ? (
            <GlassCard>
              <Text style={styles.sectionTitle}>Admin 2FA required</Text>
              <Text style={styles.sectionSubtitle}>
                This account has a staff role, but backend routes require two-factor authentication before the mobile workspace can open.
              </Text>
            </GlassCard>
          ) : !adminTwoFactorToken ? (
            <GlassCard>
              <Text style={styles.sectionTitle}>Verify staff access</Text>
              <Text style={styles.sectionSubtitle}>
                Enter the current 2FA code for this account. The token is stored locally for this device session.
              </Text>
              <Text style={styles.fieldLabel}>2FA code</Text>
              <TextInput
                value={adminTwoFactorCode}
                onChangeText={(value) => setAdminTwoFactorCode(value.replace(/\D/g, '').slice(0, 6))}
                autoCapitalize="none"
                keyboardType="number-pad"
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor="#6f7e99"
              />
              <Pressable style={styles.primaryButton} onPress={verifyAdminWorkspace}>
                <Text style={styles.primaryButtonText}>Unlock staff workspace</Text>
              </Pressable>
            </GlassCard>
          ) : (
            <>
              <View style={styles.statsGrid}>
                {adminOverviewCards.map((item) => (
                  <GlassCard key={item.label} style={styles.statCardTall}>
                    <Text style={styles.statLabel}>{item.label}</Text>
                    <Text style={styles.statValue}>{item.value}</Text>
                  </GlassCard>
                ))}
              </View>

              {adminSection === 'support' ? (
                <GlassCard>
                  <Text style={styles.sectionTitle}>Support queue</Text>
                  <Text style={styles.sectionSubtitle}>Review incoming tickets and move them through support states.</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {ADMIN_FEEDBACK_STATUSES.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[styles.choiceChip, adminFeedbackStatus === option.value ? styles.choiceChipActive : null]}
                        onPress={() => setAdminFeedbackStatus(option.value)}
                      >
                        <Text style={[styles.choiceChipText, adminFeedbackStatus === option.value ? styles.choiceChipTextActive : null]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {adminFeedback.length > 0 ? (
                    <View style={styles.supportTicketStack}>
                      {adminFeedback.slice(0, 12).map((ticket) => (
                        <View key={ticket.id} style={styles.supportTicketCard}>
                          <View style={styles.supportTicketTopLine}>
                            <Text style={styles.supportTicketTitle} numberOfLines={1}>{ticket.subject || 'Ticket'}</Text>
                            <View style={[styles.statusPill, styles.statusPillMuted]}>
                              <Text style={styles.statusPillText}>{ticket.statusLabel || ticket.status || 'Open'}</Text>
                            </View>
                          </View>
                          <Text style={styles.supportTicketBody} numberOfLines={4}>{ticket.body || 'No description'}</Text>
                          <Text style={styles.supportTicketMeta}>
                            {(ticket.user?.username || ticket.userId || 'user').toUpperCase()} · {(ticket.priority || 'normal').toUpperCase()} · {humanDate(ticket.updatedAt || ticket.createdAt)}
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {ADMIN_FEEDBACK_STATUSES.map((option) => (
                              <Pressable
                                key={`${ticket.id}_${option.value}`}
                                style={[styles.choiceChip, (ticket.status || 'open') === option.value ? styles.choiceChipActive : null]}
                                onPress={() => onPatchAdminTicketStatus(ticket.id, option.value)}
                              >
                                <Text style={[styles.choiceChipText, (ticket.status || 'open') === option.value ? styles.choiceChipTextActive : null]}>
                                  {option.label}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.sectionSubtitle}>No tickets in this state.</Text>
                  )}
                </GlassCard>
              ) : null}

              {adminSection === 'moderation' ? (
                <>
                  <GlassCard>
                    <Text style={styles.sectionTitle}>Moderation desk</Text>
                    <Text style={styles.sectionSubtitle}>Reports, active bans, and banned-word rules from the same mobile workspace.</Text>
                    <View style={styles.statsGrid}>
                      <GlassCard style={styles.statCardTall}>
                        <Text style={styles.statLabel}>Reports</Text>
                        <Text style={styles.statValue}>{adminReports.length}</Text>
                      </GlassCard>
                      <GlassCard style={styles.statCardTall}>
                        <Text style={styles.statLabel}>Queue</Text>
                        <Text style={styles.statValue}>{adminModQueue.length}</Text>
                      </GlassCard>
                      <GlassCard style={styles.statCardTall}>
                        <Text style={styles.statLabel}>Bans</Text>
                        <Text style={styles.statValue}>{adminBans.length}</Text>
                      </GlassCard>
                      <GlassCard style={styles.statCardTall}>
                        <Text style={styles.statLabel}>Rules</Text>
                        <Text style={styles.statValue}>{adminBannedWords.length}</Text>
                      </GlassCard>
                    </View>
                  </GlassCard>

                  <GlassCard>
                    <Text style={styles.sectionTitle}>Ban user</Text>
                    <Text style={styles.sectionSubtitle}>Find an account, choose a target, and apply a manual ban from mobile.</Text>
                    <View style={styles.searchComposerRow}>
                      <TextInput
                        value={adminModerationSearchQ}
                        onChangeText={setAdminModerationSearchQ}
                        style={[styles.input, styles.searchInputInline]}
                        placeholder="Search username"
                        placeholderTextColor="#6f7e99"
                      />
                      <Pressable style={styles.primaryButtonCompact} onPress={onFindModerationUser}>
                        <Text style={styles.primaryButtonText}>Find</Text>
                      </Pressable>
                    </View>
                    {adminModerationSearchLoading ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}
                    {adminModerationSearchResults.length > 0 ? (
                      <View style={styles.supportTicketStack}>
                        {adminModerationSearchResults.map((result) => (
                          <View key={result.id} style={styles.searchResultCard}>
                            <View style={styles.searchIdentityRow}>
                              <View style={styles.avatarSmall}>
                                <Text style={styles.avatarSmallText}>{getInitials(result.username)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.searchResultTitle}>{result.username}</Text>
                                <Text style={styles.searchResultText}>{result.id}</Text>
                              </View>
                            </View>
                            <Pressable
                              style={[
                                styles.secondaryActionButton,
                                adminBanTargetUserId === result.id ? styles.choiceChipActive : null,
                              ]}
                              onPress={() => {
                                setAdminBanTargetUserId(result.id);
                                setAdminBanTargetUsername(result.username);
                              }}
                            >
                              <Text
                                style={[
                                  styles.secondaryActionButtonText,
                                  adminBanTargetUserId === result.id ? styles.choiceChipTextActive : null,
                                ]}
                              >
                                {adminBanTargetUserId === result.id ? 'Selected' : 'Choose'}
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Text style={styles.fieldLabel}>Selected user</Text>
                    <View style={styles.adminInfoCard}>
                      <Text style={styles.adminInfoTitle}>{adminBanTargetUsername || 'No user selected'}</Text>
                      <Text style={styles.adminInfoBody}>{adminBanTargetUserId || 'Pick a user from the search results above.'}</Text>
                    </View>
                    <Text style={styles.fieldLabel}>Reason</Text>
                    <TextInput
                      value={adminBanReason}
                      onChangeText={setAdminBanReason}
                      style={[styles.input, styles.multilineInput]}
                      placeholder="Explain why the account is being banned"
                      placeholderTextColor="#6f7e99"
                      multiline
                      textAlignVertical="top"
                    />
                    <View style={styles.switchRow}>
                      <Text style={styles.fieldLabel}>Permanent ban</Text>
                      <Switch value={adminBanPermanent} onValueChange={setAdminBanPermanent} />
                    </View>
                    {!adminBanPermanent ? (
                      <>
                        <Text style={styles.fieldLabel}>Expires at</Text>
                        <TextInput
                          value={adminBanExpiresAt}
                          onChangeText={setAdminBanExpiresAt}
                          style={styles.input}
                          placeholder="2026-03-20T18:00"
                          placeholderTextColor="#6f7e99"
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}
                    <Pressable style={styles.dangerButtonInline} onPress={onCreateAdminBan}>
                      <Text style={styles.dangerButtonInlineText}>Ban user</Text>
                    </Pressable>
                  </GlassCard>

                  <GlassCard>
                    <Text style={styles.sectionTitle}>Active bans</Text>
                    <Text style={styles.sectionSubtitle}>Live ban list from backend.</Text>
                    {adminBans.length > 0 ? (
                      <View style={styles.supportTicketStack}>
                        {adminBans.slice(0, 20).map((ban) => (
                          <View key={ban.id} style={styles.serverChannelCard}>
                            <Text style={styles.serverChannelTitle}>{ban.username || ban.userId}</Text>
                            <Text style={styles.serverChannelMeta}>
                              {ban.permanent ? 'Permanent' : `Until ${ban.expiresAt ? humanDate(new Date(ban.expiresAt).toISOString()) : 'unknown'}`}
                            </Text>
                            <Text style={styles.serverChannelMeta}>{ban.reason || 'No reason'}</Text>
                            <View style={styles.chatCardActions}>
                              <Pressable style={styles.deleteButtonSmall} onPress={() => onRevokeAdminBan(ban.id || ban.userId)}>
                                <Text style={styles.deleteButtonSmallText}>Unban</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.sectionSubtitle}>No active bans.</Text>
                    )}
                  </GlassCard>

                  <GlassCard>
                    <Text style={styles.sectionTitle}>Banned words</Text>
                    <Text style={styles.sectionSubtitle}>Manage moderation rules directly from mobile.</Text>
                    <Text style={styles.fieldLabel}>Phrase</Text>
                    <TextInput
                      value={adminBannedWordPhrase}
                      onChangeText={setAdminBannedWordPhrase}
                      style={styles.input}
                      placeholder="Enter phrase or regex"
                      placeholderTextColor="#6f7e99"
                    />
                    <Text style={styles.fieldLabel}>Action</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {(['warn', 'ban', 'delete_message'] as const).map((action) => (
                        <Pressable
                          key={action}
                          style={[styles.choiceChip, adminBannedWordAction === action ? styles.choiceChipActive : null]}
                          onPress={() => setAdminBannedWordAction(action)}
                        >
                          <Text style={[styles.choiceChipText, adminBannedWordAction === action ? styles.choiceChipTextActive : null]}>
                            {action}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Text style={styles.fieldLabel}>Scope</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {(['global', 'chat'] as const).map((scope) => (
                        <Pressable
                          key={scope}
                          style={[styles.choiceChip, adminBannedWordScope === scope ? styles.choiceChipActive : null]}
                          onPress={() => setAdminBannedWordScope(scope)}
                        >
                          <Text style={[styles.choiceChipText, adminBannedWordScope === scope ? styles.choiceChipTextActive : null]}>
                            {scope}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <View style={styles.switchRow}>
                      <Text style={styles.fieldLabel}>Regex rule</Text>
                      <Switch value={adminBannedWordRegex} onValueChange={setAdminBannedWordRegex} />
                    </View>
                    <Pressable style={styles.primaryButton} onPress={onCreateAdminBannedWord}>
                      <Text style={styles.primaryButtonText}>Add rule</Text>
                    </Pressable>

                    {adminBannedWords.length > 0 ? (
                      <View style={styles.supportTicketStack}>
                        {adminBannedWords.slice(0, 20).map((item) => (
                          <View key={item.id} style={styles.serverChannelCard}>
                            <Text style={styles.serverChannelTitle}>{item.phrase}</Text>
                            <Text style={styles.serverChannelMeta}>
                              {(item.action || 'warn').toUpperCase()} · {(item.scope || 'global').toUpperCase()} · {item.isRegex ? 'REGEX' : 'PLAIN'}
                            </Text>
                            <Text style={styles.serverChannelMeta}>{item.active ? 'Active' : 'Disabled'}</Text>
                            <View style={styles.chatCardActions}>
                              <Pressable style={styles.secondaryActionButton} onPress={() => onToggleAdminBannedWordActive(item)}>
                                <Text style={styles.secondaryActionButtonText}>{item.active ? 'Disable' : 'Enable'}</Text>
                              </Pressable>
                              <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteAdminBannedWord(item.id)}>
                                <Text style={styles.deleteButtonSmallText}>Delete</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </GlassCard>
                </>
              ) : null}

              {adminSection === 'risk' || adminSection === 'safety' ? (
                <GlassCard>
                  <Text style={styles.sectionTitle}>{adminSection === 'risk' ? 'Risk desk' : 'Safety operations'}</Text>
                  <Text style={styles.sectionSubtitle}>Live health and growth signals for abuse review and safety checks.</Text>
                  <View style={styles.adminMetricStack}>
                    {adminHealth?.services?.map((service) => (
                      <View key={service.name} style={styles.adminMetricRow}>
                        <Text style={styles.adminMetricLabel}>{service.name.toUpperCase()}</Text>
                        <Text style={styles.adminMetricValueSmall}>{service.status}</Text>
                      </View>
                    ))}
                    {adminAnalytics?.chart?.slice(-5).map((point) => (
                      <View key={point.date} style={styles.adminMetricRow}>
                        <Text style={styles.adminMetricLabel}>{point.date}</Text>
                        <Text style={styles.adminMetricValueSmall}>{point.messages} msg · {point.newUsers} new</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              ) : null}

              {adminSection === 'billing' ? (
                <GlassCard>
                  <Text style={styles.sectionTitle}>Billing overview</Text>
                  <Text style={styles.sectionSubtitle}>Premium conversion and revenue snapshot from backend analytics.</Text>
                  <View style={styles.adminMetricStack}>
                    <View style={styles.adminMetricRow}>
                      <Text style={styles.adminMetricLabel}>Premium users</Text>
                      <Text style={styles.adminMetricValueSmall}>{adminPremium?.premiumUsers ?? 0}</Text>
                    </View>
                    <View style={styles.adminMetricRow}>
                      <Text style={styles.adminMetricLabel}>Conversion</Text>
                      <Text style={styles.adminMetricValueSmall}>{typeof adminPremium?.conversion === 'number' ? `${adminPremium.conversion.toFixed(1)}%` : '0%'}</Text>
                    </View>
                    <View style={styles.adminMetricRow}>
                      <Text style={styles.adminMetricLabel}>Revenue</Text>
                      <Text style={styles.adminMetricValueSmall}>{adminPremium?.revenue ?? 0}</Text>
                    </View>
                  </View>
                </GlassCard>
              ) : null}

              {adminSection === 'release' ? (
                <>
                  <GlassCard>
                    <Text style={styles.sectionTitle}>Maintenance</Text>
                    <Text style={styles.sectionSubtitle}>Show global maintenance mode with schedule text and a public status message.</Text>
                    <Text style={styles.fieldLabel}>Start timestamp</Text>
                    <TextInput
                      value={adminMaintenanceTimestamp}
                      onChangeText={setAdminMaintenanceTimestamp}
                      style={styles.input}
                      placeholder="2026-03-14T23:00"
                      placeholderTextColor="#6f7e99"
                    />
                    <Text style={styles.fieldLabel}>Message</Text>
                    <TextInput
                      value={adminMaintenanceMessage}
                      onChangeText={setAdminMaintenanceMessage}
                      style={[styles.input, styles.multilineInput]}
                      placeholder="What users should know during maintenance"
                      placeholderTextColor="#6f7e99"
                      multiline
                      textAlignVertical="top"
                    />
                    <View style={styles.primaryActionsRow}>
                      <Pressable style={styles.primaryButton} onPress={onSaveAdminMaintenance}>
                        <Text style={styles.primaryButtonText}>Enable / update</Text>
                      </Pressable>
                      <Pressable style={styles.secondaryButtonWide} onPress={onDisableMaintenance}>
                        <Text style={styles.secondaryButtonText}>Disable</Text>
                      </Pressable>
                    </View>
                  </GlassCard>

                  <GlassCard>
                    <Text style={styles.sectionTitle}>System banner</Text>
                    <Text style={styles.sectionSubtitle}>Run a dismissible or pinned banner across web and desktop.</Text>
                    <Text style={styles.fieldLabel}>Title</Text>
                    <TextInput
                      value={adminBannerTitle}
                      onChangeText={setAdminBannerTitle}
                      style={styles.input}
                      placeholder="Optional title"
                      placeholderTextColor="#6f7e99"
                    />
                    <Text style={styles.fieldLabel}>Message</Text>
                    <TextInput
                      value={adminBannerMessage}
                      onChangeText={setAdminBannerMessage}
                      style={[styles.input, styles.multilineInput]}
                      placeholder="Banner text"
                      placeholderTextColor="#6f7e99"
                      multiline
                      textAlignVertical="top"
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {SYSTEM_BANNER_SEVERITIES.map((option) => (
                        <Pressable
                          key={option.value}
                          style={[styles.choiceChip, adminBannerSeverity === option.value ? styles.choiceChipActive : null]}
                          onPress={() => setAdminBannerSeverity(option.value)}
                        >
                          <Text style={[styles.choiceChipText, adminBannerSeverity === option.value ? styles.choiceChipTextActive : null]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Text style={styles.fieldLabel}>Starts at</Text>
                    <TextInput
                      value={adminBannerStartsAt}
                      onChangeText={setAdminBannerStartsAt}
                      style={styles.input}
                      placeholder="2026-03-14T22:00"
                      placeholderTextColor="#6f7e99"
                    />
                    <Text style={styles.fieldLabel}>Ends at</Text>
                    <TextInput
                      value={adminBannerEndsAt}
                      onChangeText={setAdminBannerEndsAt}
                      style={styles.input}
                      placeholder="2026-03-14T23:00"
                      placeholderTextColor="#6f7e99"
                    />
                    <View style={styles.toggleRowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleTitle}>Dismissible</Text>
                        <Text style={styles.toggleText}>Allow users to close this banner on their current device.</Text>
                      </View>
                      <Switch value={adminBannerDismissible} onValueChange={setAdminBannerDismissible} />
                    </View>
                    <View style={styles.primaryActionsRow}>
                      <Pressable style={styles.primaryButton} onPress={onSaveAdminBanner}>
                        <Text style={styles.primaryButtonText}>Publish banner</Text>
                      </Pressable>
                      <Pressable style={styles.secondaryButtonWide} onPress={onDisableAdminBanner}>
                        <Text style={styles.secondaryButtonText}>Disable banner</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                </>
              ) : null}

              {adminSection === 'sysadmin' || adminSection === 'owner' ? (
                <>
                  <GlassCard>
                    <Text style={styles.sectionTitle}>Users</Text>
                    <Text style={styles.sectionSubtitle}>Review accounts and apply operational actions from mobile.</Text>
                    <TextInput
                      value={adminUserSearch}
                      onChangeText={setAdminUserSearch}
                      style={styles.input}
                      placeholder="Search by username or email"
                      placeholderTextColor="#6f7e99"
                    />
                    <Pressable style={styles.secondaryButtonWide} onPress={onRefreshAdminOverview}>
                      <Text style={styles.secondaryButtonText}>Load matching users</Text>
                    </Pressable>
                    <View style={styles.supportTicketStack}>
                      {adminUsers.slice(0, 20).map((item) => (
                        <View key={item.id} style={styles.supportTicketCard}>
                          <View style={styles.supportTicketTopLine}>
                            <Text style={styles.supportTicketTitle}>@{item.username}</Text>
                            <View style={[styles.statusPill, item.status === 'suspended' ? styles.statusPillPlain : styles.statusPillMuted]}>
                              <Text style={styles.statusPillText}>{item.status || 'online'}</Text>
                            </View>
                          </View>
                          <Text style={styles.supportTicketMeta}>
                            {(Array.isArray(item.roles) ? item.roles.join(', ') : item.roles || 'user').toUpperCase()} · {item.email || 'no email'}
                          </Text>
                          <View style={styles.adminActionRow}>
                            <Pressable style={styles.secondaryActionButton} onPress={() => runAdminUserAction('suspend', item)}>
                              <Text style={styles.secondaryActionButtonText}>Suspend</Text>
                            </Pressable>
                            <Pressable style={styles.secondaryActionButton} onPress={() => runAdminUserAction('unsuspend', item)}>
                              <Text style={styles.secondaryActionButtonText}>Restore</Text>
                            </Pressable>
                            <Pressable style={styles.deleteButtonSmall} onPress={() => runAdminUserAction('block', item)}>
                              <Text style={styles.deleteButtonSmallText}>Block</Text>
                            </Pressable>
                            <Pressable style={styles.secondaryActionButton} onPress={() => runAdminUserAction('unblock', item)}>
                              <Text style={styles.secondaryActionButtonText}>Unblock</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </GlassCard>

                  <GlassCard>
                    <Text style={styles.sectionTitle}>System health</Text>
                    <Text style={styles.sectionSubtitle}>Backend status snapshot from admin APIs.</Text>
                    <View style={styles.adminMetricStack}>
                      {adminHealth?.services?.map((service) => (
                        <View key={service.name} style={styles.adminMetricRow}>
                          <Text style={styles.adminMetricLabel}>{service.name.toUpperCase()}</Text>
                          <Text style={styles.adminMetricValueSmall}>{service.status}</Text>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </AppFrame>
    );
  }

  if (view === 'server' && selectedServer) {
    const categorizedTextSections = serverCategories
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((category) => ({
        category,
        channels: selectedServerTextChannels.filter((channel) => channel.categoryId === category.id),
      }))
      .filter((section) => section.channels.length > 0);
    const uncategorizedTextChannels = selectedServerTextChannels.filter((channel) => !channel.categoryId);
    const selectedVoiceParticipants = selectedServerVoiceChannel
      ? serverVoiceState[selectedServerVoiceChannel.id] || []
      : [];

    return (
      <AppFrame>
        <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.heroCardCompact}>
            <View style={styles.topRow}>
              <View style={styles.identityRow}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>{getInitials(selectedServer.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Server workspace</Text>
                  <Text style={styles.cardTitle}>{selectedServer.name}</Text>
                  <Text style={styles.cardSubtitle}>{selectedServer.description || connectionHost}</Text>
                </View>
              </View>
              <Pressable
                style={styles.ghostPill}
                onPress={() => {
                  setView('servers');
                  setSelectedVoiceRoom(null);
                  setSelectedVoiceChannelId('');
                }}
              >
                <Text style={styles.ghostPillText}>Back</Text>
              </Pressable>
            </View>

            <View style={styles.pillRowWrap}>
              <View style={[styles.statusPill, styles.statusPillSecure]}>
                <Text style={styles.statusPillText}>{selectedServerRole.toUpperCase()}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{serverMembers.length} members</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{serverChannels.length} channels</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{selectedServerVoiceChannels.length} voice</Text>
              </View>
            </View>

            <View style={styles.primaryActionsRow}>
              <Pressable
                style={styles.secondaryButtonWide}
                onPress={() =>
                  loadSelectedServerData(selectedServer.id, {
                    preferredVoiceChannelId: selectedVoiceChannelId || undefined,
                  })
                }
              >
                <Text style={styles.secondaryButtonText}>{serverBusy ? 'Refreshing...' : 'Refresh server'}</Text>
              </Pressable>
              {selectedServerRole !== 'owner' ? (
                <Pressable style={styles.dangerButtonInline} onPress={onLeaveSelectedServer}>
                  <Text style={styles.dangerButtonInlineText}>Leave server</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>

          {serverBusy ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}

          <GlassCard>
            <Text style={styles.sectionTitle}>Server settings</Text>
            <Text style={styles.sectionSubtitle}>Update the public name, description, and invite flow for this server.</Text>
            <Text style={styles.fieldLabel}>Server name</Text>
            <TextInput
              value={serverSettingsName}
              onChangeText={setServerSettingsName}
              style={styles.input}
              placeholder="SafeGram Lobby"
              placeholderTextColor="#6f7e99"
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              value={serverSettingsDescription}
              onChangeText={setServerSettingsDescription}
              style={[styles.input, styles.multilineInput]}
              placeholder="What this server is used for"
              placeholderTextColor="#6f7e99"
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Invite link</Text>
            <View style={styles.adminInfoCard}>
              <Text style={styles.adminInfoTitle}>Current invite</Text>
              <Text style={styles.serverAddressText}>
                {selectedServerInviteUrl || 'Invite not generated yet'}
              </Text>
              <Text style={styles.adminInfoBody}>Rotate the invite if you want a fresh onboarding link for new members.</Text>
            </View>
            <View style={styles.primaryActionsRow}>
              {canManageSelectedServer ? (
                <Pressable style={styles.primaryButton} onPress={onUpdateSelectedServer}>
                  <Text style={styles.primaryButtonText}>Save settings</Text>
                </Pressable>
              ) : null}
              {canManageSelectedServer ? (
                <Pressable style={styles.secondaryButtonWide} onPress={onRotateServerInvite}>
                  <Text style={styles.secondaryButtonText}>Rotate invite</Text>
                </Pressable>
              ) : null}
              {inviteReadyForShare ? (
                <Pressable style={styles.secondaryButtonWide} onPress={onShareSelectedServerInvite}>
                  <Text style={styles.secondaryButtonText}>Share invite</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Text channels</Text>
            <Text style={styles.sectionSubtitle}>Open a channel in the existing message screen. Channel chat history is backed by the same backend chat API.</Text>

            {categorizedTextSections.map((section) => (
              <View key={section.category.id} style={styles.serverChannelSection}>
                <View style={styles.serverCategoryHeader}>
                  <Text style={styles.serverSectionLabel}>{section.category.name}</Text>
                  {canManageSelectedServer ? (
                    <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteServerCategory(section.category)}>
                      <Text style={styles.deleteButtonSmallText}>Delete category</Text>
                    </Pressable>
                  ) : null}
                </View>
                {section.channels.map((channel) => (
                  <View key={channel.id} style={styles.serverChannelCard}>
                    <Pressable style={styles.serverChannelPrimary} onPress={() => onOpenServerTextChannel(channel)}>
                      <Text style={styles.serverChannelTitle}># {channel.name}</Text>
                      <Text style={styles.serverChannelMeta}>Text channel · synced with main chat API</Text>
                    </Pressable>
                    <View style={styles.chatCardActions}>
                      <Pressable style={styles.secondaryActionButton} onPress={() => onOpenServerTextChannel(channel)}>
                        <Text style={styles.secondaryActionButtonText}>Open</Text>
                      </Pressable>
                      {canManageSelectedServer ? (
                        <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteServerChannel(channel)}>
                          <Text style={styles.deleteButtonSmallText}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {canManageSelectedServer ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        <Pressable
                          style={[styles.choiceChip, !channel.categoryId ? styles.choiceChipActive : null]}
                          onPress={() => onMoveServerChannelToCategory(channel)}
                        >
                          <Text style={[styles.choiceChipText, !channel.categoryId ? styles.choiceChipTextActive : null]}>
                            General
                          </Text>
                        </Pressable>
                        {serverCategories.map((category) => (
                          <Pressable
                            key={`${channel.id}_${category.id}`}
                            style={[styles.choiceChip, channel.categoryId === category.id ? styles.choiceChipActive : null]}
                            onPress={() => onMoveServerChannelToCategory(channel, category.id)}
                          >
                            <Text
                              style={[
                                styles.choiceChipText,
                                channel.categoryId === category.id ? styles.choiceChipTextActive : null,
                              ]}
                            >
                              {category.name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}

            {uncategorizedTextChannels.length > 0 ? (
              <View style={styles.serverChannelSection}>
                <Text style={styles.serverSectionLabel}>General</Text>
                {uncategorizedTextChannels.map((channel) => (
                  <View key={channel.id} style={styles.serverChannelCard}>
                    <Pressable style={styles.serverChannelPrimary} onPress={() => onOpenServerTextChannel(channel)}>
                      <Text style={styles.serverChannelTitle}># {channel.name}</Text>
                      <Text style={styles.serverChannelMeta}>Text channel</Text>
                    </Pressable>
                    <View style={styles.chatCardActions}>
                      <Pressable style={styles.secondaryActionButton} onPress={() => onOpenServerTextChannel(channel)}>
                        <Text style={styles.secondaryActionButtonText}>Open</Text>
                      </Pressable>
                      {canManageSelectedServer ? (
                        <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteServerChannel(channel)}>
                          <Text style={styles.deleteButtonSmallText}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {canManageSelectedServer && serverCategories.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        <Pressable style={[styles.choiceChip, styles.choiceChipActive]} onPress={() => onMoveServerChannelToCategory(channel)}>
                          <Text style={[styles.choiceChipText, styles.choiceChipTextActive]}>General</Text>
                        </Pressable>
                        {serverCategories.map((category) => (
                          <Pressable
                            key={`${channel.id}_${category.id}`}
                            style={styles.choiceChip}
                            onPress={() => onMoveServerChannelToCategory(channel, category.id)}
                          >
                            <Text style={styles.choiceChipText}>{category.name}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {selectedServerTextChannels.length === 0 ? (
              <Text style={styles.sectionSubtitle}>No text channels in this server yet.</Text>
            ) : null}
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Voice rooms</Text>
            <Text style={styles.sectionSubtitle}>Mobile currently shows live participant presence and room state. Full audio transport still needs a native WebRTC stack.</Text>

            {selectedServerVoiceChannels.length > 0 ? (
              <View style={styles.supportTicketStack}>
                {selectedServerVoiceChannels.map((channel) => {
                  const participantIds = serverVoiceState[channel.id] || [];
                  const isSelected = selectedVoiceChannelId === channel.id;
                  return (
                    <View key={channel.id} style={[styles.serverChannelCard, isSelected ? styles.serverChannelCardActive : null]}>
                      <Pressable style={styles.serverChannelPrimary} onPress={() => onSelectServerVoiceChannel(channel)}>
                        <Text style={styles.serverChannelTitle}>Voice · {channel.name}</Text>
                        <Text style={styles.serverChannelMeta}>
                          {participantIds.length > 0
                            ? `${participantIds.length} connected · ${participantIds.map((id) => getServerMemberName(id)).join(', ')}`
                            : 'Nobody connected yet'}
                        </Text>
                      </Pressable>
                      <View style={styles.chatCardActions}>
                        <Pressable style={styles.secondaryActionButton} onPress={() => onSelectServerVoiceChannel(channel)}>
                          <Text style={styles.secondaryActionButtonText}>Monitor</Text>
                        </Pressable>
                        {selectedVoiceRoom && isSelected ? (
                          <Pressable
                            style={selectedVoiceRoom.createdBy === user?.id ? styles.dangerButtonSmall : styles.secondaryActionButton}
                            onPress={selectedVoiceRoom.createdBy === user?.id ? onEndVoiceRoom : () => onSelectServerVoiceChannel(channel)}
                          >
                            <Text style={selectedVoiceRoom.createdBy === user?.id ? styles.deleteButtonSmallText : styles.secondaryActionButtonText}>
                              {selectedVoiceRoom.createdBy === user?.id ? 'End room' : 'Active'}
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable style={styles.secondaryActionButton} onPress={() => onStartVoiceRoom(channel)}>
                            <Text style={styles.secondaryActionButtonText}>Start room</Text>
                          </Pressable>
                        )}
                        {canManageSelectedServer ? (
                          <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteServerChannel(channel)}>
                            <Text style={styles.deleteButtonSmallText}>Delete</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {canManageSelectedServer ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                          <Pressable
                            style={[styles.choiceChip, !channel.categoryId ? styles.choiceChipActive : null]}
                            onPress={() => onMoveServerChannelToCategory(channel)}
                          >
                            <Text style={[styles.choiceChipText, !channel.categoryId ? styles.choiceChipTextActive : null]}>
                              General
                            </Text>
                          </Pressable>
                          {serverCategories.map((category) => (
                            <Pressable
                              key={`${channel.id}_${category.id}`}
                              style={[styles.choiceChip, channel.categoryId === category.id ? styles.choiceChipActive : null]}
                              onPress={() => onMoveServerChannelToCategory(channel, category.id)}
                            >
                              <Text
                                style={[
                                  styles.choiceChipText,
                                  channel.categoryId === category.id ? styles.choiceChipTextActive : null,
                                ]}
                              >
                                {category.name}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.sectionSubtitle}>No voice channels yet.</Text>
            )}

            {selectedServerVoiceChannel ? (
              <View style={styles.adminInfoCard}>
                <Text style={styles.adminInfoTitle}>Selected voice room</Text>
                <Text style={styles.serverAddressText}>{selectedServerVoiceChannel.name}</Text>
                <Text style={styles.adminInfoBody}>
                  {selectedVoiceRoom
                    ? `Room active since ${humanDate(selectedVoiceRoom.createdAt)}. Started by ${getServerMemberName(selectedVoiceRoom.createdBy)}.`
                    : 'No active room on this channel right now.'}
                </Text>
                <Text style={styles.adminInfoBody}>
                  Participants: {selectedVoiceParticipants.length > 0 ? selectedVoiceParticipants.map((id) => getServerMemberName(id)).join(', ') : 'none'}
                </Text>
              </View>
            ) : null}
          </GlassCard>

          {canManageSelectedServer ? (
            <GlassCard>
              <Text style={styles.sectionTitle}>Server controls</Text>
              <Text style={styles.sectionSubtitle}>Create categories and channels from the same mobile shell.</Text>

              <Text style={styles.fieldLabel}>New category</Text>
              <View style={styles.searchComposerRow}>
                <TextInput
                  value={categoryDraftName}
                  onChangeText={setCategoryDraftName}
                  style={[styles.input, styles.searchInputInline]}
                  placeholder="Announcements"
                  placeholderTextColor="#6f7e99"
                />
                <Pressable style={styles.primaryButtonCompact} onPress={onCreateServerCategory}>
                  <Text style={styles.primaryButtonText}>Add</Text>
                </Pressable>
              </View>

              {serverCategories.length > 0 ? (
                <View style={styles.supportTicketStack}>
                  {serverCategories.map((category) => (
                    <View key={category.id} style={styles.serverChannelCard}>
                      <Text style={styles.serverChannelTitle}>{category.name}</Text>
                      <Text style={styles.serverChannelMeta}>Position {category.position}</Text>
                      <View style={styles.chatCardActions}>
                        <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteServerCategory(category)}>
                          <Text style={styles.deleteButtonSmallText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>New channel</Text>
              <TextInput
                value={channelDraftName}
                onChangeText={setChannelDraftName}
                style={styles.input}
                placeholder="general, updates, stage..."
                placeholderTextColor="#6f7e99"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {(['text', 'voice'] as const).map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.choiceChip, channelDraftType === type ? styles.choiceChipActive : null]}
                    onPress={() => setChannelDraftType(type)}
                  >
                    <Text style={[styles.choiceChipText, channelDraftType === type ? styles.choiceChipTextActive : null]}>
                      {type === 'text' ? 'Text channel' : 'Voice channel'}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.primaryButton} onPress={onCreateServerChannel}>
                <Text style={styles.primaryButtonText}>Create channel</Text>
              </Pressable>
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.sectionSubtitle}>Live member list for this server.</Text>
            {canManageSelectedServer ? (
              <>
                <Text style={styles.fieldLabel}>Add members</Text>
                <View style={styles.searchComposerRow}>
                  <TextInput
                    value={serverMemberSearchQ}
                    onChangeText={setServerMemberSearchQ}
                    style={[styles.input, styles.searchInputInline]}
                    placeholder="Search users to add"
                    placeholderTextColor="#6f7e99"
                  />
                  <Pressable style={styles.primaryButtonCompact} onPress={onFindServerMembersToAdd}>
                    <Text style={styles.primaryButtonText}>Find</Text>
                  </Pressable>
                </View>
                {serverMemberSearchLoading ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}
                {serverMemberSearchResults.length > 0 ? (
                  <View style={styles.supportTicketStack}>
                    {serverMemberSearchResults.slice(0, 8).map((result) => (
                      <View key={result.id} style={styles.searchResultCard}>
                        <View style={styles.searchIdentityRow}>
                          <View style={styles.avatarSmall}>
                            <Text style={styles.avatarSmallText}>{getInitials(result.username)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.searchResultTitle}>{result.username}</Text>
                            <Text style={styles.searchResultText}>Available to add to this server</Text>
                          </View>
                        </View>
                        <View style={styles.chatCardActions}>
                          <Pressable style={styles.primaryButtonCompact} onPress={() => onAddServerMember(result.id)}>
                            <Text style={styles.primaryButtonText}>Add</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            {serverMembers.length > 0 ? (
              <View style={styles.supportTicketStack}>
                {serverMembers.slice(0, 18).map((member) => (
                  <View key={member.id} style={styles.searchResultCard}>
                    <View style={styles.searchIdentityRow}>
                      <View style={styles.avatarSmall}>
                        <Text style={styles.avatarSmallText}>{getInitials(member.user?.username)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchResultTitle}>{member.user?.username || member.userId}</Text>
                        <Text style={styles.searchResultText}>
                          {(member.role || 'member').toUpperCase()} · {member.user?.status || 'offline'} · {humanDate(member.joinedAt)}
                        </Text>
                        {(member.roles || []).length > 0 ? (
                          <Text style={styles.searchResultText}>
                            Custom roles: {(member.roles || []).map((role) => role.name || role.id || 'role').join(', ')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {canManageSelectedServer && member.userId !== user?.id ? (
                      <View style={styles.memberRoleTools}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                          {(['member', 'moderator', 'admin'] as const).map((role) => (
                            <Pressable
                              key={`${member.id}_${role}`}
                              style={[styles.choiceChip, (member.role || 'member') === role ? styles.choiceChipActive : null]}
                              onPress={() => onSetSelectedServerMemberRole(member, role)}
                            >
                              <Text style={[styles.choiceChipText, (member.role || 'member') === role ? styles.choiceChipTextActive : null]}>
                                {role}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                        {serverRoles.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {serverRoles.map((role) => {
                              const enabled = (member.roles || []).some((assigned) => assigned.id === role.id);
                              return (
                                <Pressable
                                  key={`${member.id}_custom_${role.id}`}
                                  style={[styles.choiceChip, enabled ? styles.choiceChipActive : null]}
                                  onPress={() => onToggleServerMemberCustomRole(member, role.id)}
                                >
                                  <Text style={[styles.choiceChipText, enabled ? styles.choiceChipTextActive : null]}>
                                    {role.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionSubtitle}>No members loaded.</Text>
            )}
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Server roles</Text>
            <Text style={styles.sectionSubtitle}>Create custom roles, tune permissions, and assign them to members from mobile.</Text>
            {canManageSelectedServer ? (
              <>
                <Text style={styles.fieldLabel}>Role name</Text>
                <TextInput
                  value={serverRoleDraftName}
                  onChangeText={setServerRoleDraftName}
                  style={styles.input}
                  placeholder="Announcements team"
                  placeholderTextColor="#6f7e99"
                />
                <Text style={styles.fieldLabel}>Color</Text>
                <TextInput
                  value={serverRoleDraftColor}
                  onChangeText={(value) => setServerRoleDraftColor(value.replace(/[^a-fA-F0-9]/g, '').slice(0, 6))}
                  style={styles.input}
                  placeholder="99aab5"
                  placeholderTextColor="#6f7e99"
                  autoCapitalize="none"
                />
                <Text style={styles.fieldLabel}>Permissions</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {serverAllPermissions.map((permission) => (
                    <Pressable
                      key={permission}
                      style={[styles.choiceChip, serverRoleDraftPermissions.includes(permission) ? styles.choiceChipActive : null]}
                      onPress={() => onToggleServerRolePermission(permission)}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          serverRoleDraftPermissions.includes(permission) ? styles.choiceChipTextActive : null,
                        ]}
                      >
                        {permission}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.primaryActionsRow}>
                  <Pressable style={styles.primaryButton} onPress={onSaveServerRole}>
                    <Text style={styles.primaryButtonText}>{editingServerRoleId ? 'Save role' : 'Create role'}</Text>
                  </Pressable>
                  {editingServerRoleId ? (
                    <Pressable style={styles.secondaryButtonWide} onPress={onResetServerRoleDraft}>
                      <Text style={styles.secondaryButtonText}>Cancel edit</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
            {serverRoles.length > 0 ? (
              <View style={styles.supportTicketStack}>
                {serverRoles.map((role) => (
                  <View key={role.id} style={styles.serverChannelCard}>
                    <Text style={styles.serverChannelTitle}>{role.name}</Text>
                    <Text style={styles.serverChannelMeta}>
                      {role.color ? `#${role.color}` : 'no color'} · position {role.position ?? 0}
                    </Text>
                    <Text style={styles.serverChannelMeta}>
                      {(role.permissions || []).length > 0 ? role.permissions!.join(', ') : 'No explicit permissions'}
                    </Text>
                    {canManageSelectedServer ? (
                      <View style={styles.chatCardActions}>
                        <Pressable style={styles.secondaryActionButton} onPress={() => onStartEditServerRole(role)}>
                          <Text style={styles.secondaryActionButtonText}>Edit</Text>
                        </Pressable>
                        <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteSelectedServerRole(role)}>
                          <Text style={styles.deleteButtonSmallText}>Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionSubtitle}>No custom roles on this server yet.</Text>
            )}
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Recent history</Text>
            <Text style={styles.sectionSubtitle}>Latest member and moderation events recorded by backend.</Text>
            {serverHistory.length > 0 ? (
              <View style={styles.supportTicketStack}>
                {serverHistory.slice(0, 12).map((event) => (
                  <View key={event.id} style={styles.serverChannelCard}>
                    <Text style={styles.serverChannelTitle}>{event.action}</Text>
                    <Text style={styles.serverChannelMeta}>
                      user {getServerMemberName(event.userId)} · actor {getServerMemberName(event.actorId || event.actorID)}
                    </Text>
                    <Text style={styles.serverChannelMeta}>{humanDate(event.createdAt)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionSubtitle}>No recent server history.</Text>
            )}
          </GlassCard>
        </ScrollView>
      </AppFrame>
    );
  }

  if (view === 'servers') {
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
                  <Text style={styles.eyebrow}>Server network</Text>
                  <Text style={styles.cardTitle}>SafeGram servers</Text>
                  <Text style={styles.cardSubtitle}>Community lobby, private spaces, and voice presence in one list.</Text>
                </View>
              </View>
              <Pressable style={styles.ghostPill} onPress={() => setView('chats')}>
                <Text style={styles.ghostPillText}>Inbox</Text>
              </Pressable>
            </View>

            <View style={styles.primaryActionsRow}>
              <Pressable style={styles.secondaryButtonWide} onPress={() => loadServersSafe(token)}>
                <Text style={styles.secondaryButtonText}>{serversLoading ? 'Refreshing...' : 'Refresh servers'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButtonWide} onPress={() => setView('settings')}>
                <Text style={styles.secondaryButtonText}>Settings</Text>
              </Pressable>
            </View>
          </GlassCard>

          <View style={styles.statsGrid}>
            <GlassCard style={styles.statCardTall}>
              <Text style={styles.statLabel}>Servers</Text>
              <Text style={styles.statValue}>{servers.length}</Text>
            </GlassCard>
            <GlassCard style={styles.statCardTall}>
              <Text style={styles.statLabel}>Text</Text>
              <Text style={styles.statValue}>{selectedServerTextChannels.length}</Text>
            </GlassCard>
            <GlassCard style={styles.statCardTall}>
              <Text style={styles.statLabel}>Voice</Text>
              <Text style={styles.statValue}>{selectedServerVoiceChannels.length}</Text>
            </GlassCard>
            <GlassCard style={styles.statCardTall}>
              <Text style={styles.statLabel}>Role</Text>
              <Text style={styles.statValue}>{hasStaffWorkspace ? 'Staff' : 'User'}</Text>
            </GlassCard>
          </View>

          <GlassCard>
            <Text style={styles.sectionTitle}>Join by invite</Text>
            <Text style={styles.sectionSubtitle}>Paste an invite code or a full `/app/servers/join/...` link from SafeGram.</Text>
            <TextInput
              value={serverJoinCode}
              onChangeText={setServerJoinCode}
              style={styles.input}
              placeholder="safegram-lobby or full invite link"
              placeholderTextColor="#6f7e99"
              autoCapitalize="none"
            />
            <Pressable style={styles.primaryButton} onPress={onJoinServerByCode}>
              <Text style={styles.primaryButtonText}>{serverBusy ? 'Joining...' : 'Join server'}</Text>
            </Pressable>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>Create server</Text>
            <Text style={styles.sectionSubtitle}>Spin up a new workspace and get a default #general text channel instantly.</Text>
            <Text style={styles.fieldLabel}>Server name</Text>
            <TextInput
              value={serverDraftName}
              onChangeText={setServerDraftName}
              style={styles.input}
              placeholder="SafeGram Club"
              placeholderTextColor="#6f7e99"
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              value={serverDraftDescription}
              onChangeText={setServerDraftDescription}
              style={[styles.input, styles.multilineInput]}
              placeholder="What this server is for"
              placeholderTextColor="#6f7e99"
              multiline
              textAlignVertical="top"
            />
            <Pressable style={styles.primaryButton} onPress={onCreateServer}>
              <Text style={styles.primaryButtonText}>{serverBusy ? 'Creating...' : 'Create server'}</Text>
            </Pressable>
          </GlassCard>

          <GlassCard>
            <Text style={styles.sectionTitle}>My servers</Text>
            <Text style={styles.sectionSubtitle}>Open an existing server, then switch between text channels and voice status.</Text>
            {serversLoading ? <ActivityIndicator color="#6fc2ff" style={styles.inlineLoader} /> : null}
            {servers.length > 0 ? (
              <View style={styles.supportTicketStack}>
                {servers.map((server) => (
                  <Pressable key={server.id} style={styles.serverCard} onPress={() => openServer(server)}>
                    <View style={styles.searchIdentityRow}>
                      <View style={styles.avatarLarge}>
                        <Text style={styles.avatarLargeText}>{getInitials(server.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.chatTitle}>{server.name}</Text>
                        <Text style={styles.chatSubtitle} numberOfLines={2}>
                          {server.description || 'No description yet'}
                        </Text>
                        <View style={styles.chatMetaRow}>
                          <View style={styles.metaPill}>
                            <Text style={styles.metaPillText}>{server.inviteLink ? 'Invite ready' : 'Private'}</Text>
                          </View>
                          <View style={styles.metaPill}>
                            <Text style={styles.metaPillText}>{humanRelativeTime(server.updatedAt || server.createdAt)}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionSubtitle}>No servers yet. Create one above or use the lobby after next login.</Text>
            )}
          </GlassCard>
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
                    setView(chatOrigin === 'server' && selectedServer ? 'server' : 'chats');
                  }}
                >
                  <Text style={styles.ghostPillText}>Back</Text>
                </Pressable>
                <View style={styles.chatHeaderActions}>
                  <Pressable style={styles.ghostPill} onPress={onRefreshMessages}>
                    <Text style={styles.ghostPillText}>Sync</Text>
                  </Pressable>
                  <Pressable style={styles.ghostPill} onPress={() => onToggleArchiveChat(selectedChat)}>
                    <Text style={styles.ghostPillText}>{selectedChat.archivedAt ? 'Restore' : 'Archive'}</Text>
                  </Pressable>
                  <Pressable style={styles.dangerGhostPill} onPress={() => onDeleteChat(selectedChat)}>
                    <Text style={styles.dangerGhostPillText}>Delete</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.chatIdentityRow}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>{getInitials(selectedChatTitle)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{selectedChatTitle}</Text>
                  <Text style={styles.cardSubtitle}>Connection: {connectionHost}</Text>
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
                  <Text style={styles.emptyStateText}>Start the conversation with a message or attachment.</Text>
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
                    <Text style={styles.cardTitle}>{user ? `@${user.username}` : 'SafeGram'}</Text>
                    <Text style={styles.cardSubtitle}>{connectionHost}</Text>
                  </View>
                </View>
                <Pressable style={styles.ghostPill} onPress={() => setView('servers')}>
                  <Text style={styles.ghostPillText}>Servers</Text>
                </Pressable>
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
                <Pressable
                  style={[styles.statusPill, showArchivedOnly ? styles.statusPillSecure : styles.statusPillMuted]}
                  onPress={() => setShowArchivedOnly((prev) => !prev)}
                >
                  <Text style={styles.statusPillText}>{showArchivedOnly ? 'Showing archive' : 'Showing active chats'}</Text>
                </Pressable>
              </View>
            </GlassCard>

            <View style={styles.statsGrid}>
              <GlassCard style={styles.statCardTall}>
                <Text style={styles.statLabel}>Active</Text>
                <Text style={styles.statValue}>{chatsStats.active}</Text>
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
                <Text style={styles.statLabel}>Archived</Text>
                <Text style={styles.statValue}>{chatsStats.archived}</Text>
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
            <Text style={styles.emptyStateTitle}>{showArchivedOnly ? 'Archive is empty' : 'No chats loaded'}</Text>
            <Text style={styles.emptyStateText}>
              {showArchivedOnly
                ? 'Archived chats will appear here. Restore any chat to move it back into the main list.'
                : 'Search for a user above and create your first DM to start testing.'}
            </Text>
          </GlassCard>
        }
        renderItem={({ item }) => {
          const title = getChatCardTitle(item);
          const subtitle = getChatCardSubtitle(item);
          const starred = starredChats.has(item.id);
          return (
            <View style={styles.chatCard}>
              <Pressable style={styles.chatCardOpenArea} onPress={() => onOpenChat(item)}>
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
                      {item.archivedAt ? (
                        <View style={[styles.metaPill, styles.metaPillArchived]}>
                          <Text style={styles.metaPillText}>Archived</Text>
                        </View>
                      ) : null}
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
              </Pressable>
              <View style={styles.chatCardActions}>
                <Pressable style={[styles.starButton, starred ? styles.starButtonActive : null]} onPress={() => onToggleStarChat(item.id)}>
                  <Text style={styles.starButtonText}>{starred ? 'Starred' : 'Star'}</Text>
                </Pressable>
                <Pressable style={styles.secondaryActionButton} onPress={() => onToggleArchiveChat(item)}>
                  <Text style={styles.secondaryActionButtonText}>{item.archivedAt ? 'Restore' : 'Archive'}</Text>
                </Pressable>
                <Pressable style={styles.deleteButtonSmall} onPress={() => onDeleteChat(item)}>
                  <Text style={styles.deleteButtonSmallText}>Delete</Text>
                </Pressable>
              </View>
            </View>
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
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: 'rgba(111, 194, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  bootLogo: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
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
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  brandMark: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  brandWordmark: {
    color: '#f7fbff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  dangerGhostPill: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(228, 115, 115, 0.2)',
    backgroundColor: 'rgba(74, 21, 21, 0.82)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerGhostPillText: {
    color: '#ffe3e3',
    fontSize: 13,
    fontWeight: '800',
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
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  adminInfoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    backgroundColor: 'rgba(4, 10, 18, 0.58)',
    padding: 14,
    gap: 8,
  },
  adminInfoTitle: {
    color: '#dcecff',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  serverAddressText: {
    color: '#f7fbff',
    fontSize: 14,
    fontWeight: '700',
  },
  adminInfoBody: {
    color: '#93abc7',
    fontSize: 13,
    lineHeight: 19,
  },
  staffEntryRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
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
  adminMetricStack: {
    gap: 10,
  },
  adminMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.18)',
    backgroundColor: 'rgba(4, 10, 18, 0.58)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  adminMetricLabel: {
    color: '#cfe2f8',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  adminMetricValueSmall: {
    color: '#f7fbff',
    fontSize: 13,
    fontWeight: '800',
  },
  adminActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  chatCardOpenArea: {
    borderRadius: 18,
  },
  chatCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  metaPillArchived: {
    backgroundColor: 'rgba(58, 44, 15, 0.82)',
    borderColor: 'rgba(221, 177, 84, 0.22)',
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
  secondaryActionButton: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(111, 194, 255, 0.18)',
    backgroundColor: 'rgba(8, 16, 28, 0.74)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryActionButtonText: {
    color: '#dff0ff',
    fontWeight: '800',
    fontSize: 12,
  },
  deleteButtonSmall: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(228, 115, 115, 0.18)',
    backgroundColor: 'rgba(74, 21, 21, 0.84)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonSmallText: {
    color: '#ffe3e3',
    fontWeight: '800',
    fontSize: 12,
  },
  dangerButtonInline: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(228, 115, 115, 0.18)',
    backgroundColor: 'rgba(74, 21, 21, 0.84)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerButtonInlineText: {
    color: '#ffe3e3',
    fontWeight: '800',
    fontSize: 13,
  },
  dangerButtonSmall: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(228, 115, 115, 0.18)',
    backgroundColor: 'rgba(74, 21, 21, 0.84)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  serverChannelSection: {
    gap: 10,
    marginTop: 12,
  },
  serverCategoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  serverSectionLabel: {
    color: '#8fb5d8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  serverChannelCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.16)',
    backgroundColor: 'rgba(5, 11, 20, 0.58)',
    padding: 12,
    gap: 10,
  },
  serverChannelCardActive: {
    borderColor: 'rgba(111, 194, 255, 0.34)',
    backgroundColor: 'rgba(10, 24, 44, 0.72)',
  },
  serverChannelPrimary: {
    gap: 4,
  },
  serverChannelTitle: {
    color: '#f3fbff',
    fontWeight: '800',
    fontSize: 15,
  },
  serverChannelMeta: {
    color: '#91a8c3',
    fontSize: 12,
    lineHeight: 18,
  },
  serverCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(109, 136, 168, 0.16)',
    backgroundColor: 'rgba(12, 20, 34, 0.84)',
    padding: 14,
  },
  memberRoleTools: {
    flex: 1,
    gap: 6,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
