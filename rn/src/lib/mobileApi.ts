import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  token: 'sg_token',
  user: 'sg_user',
  apiBase: 'sg_api_base',
  secureMode: 'sg_secure_mode',
  admin2FAToken: 'sg_admin_2fa_token',
} as const;

export const DEFAULT_API_BASE = 'https://141.8.198.152.nip.io';

export interface AuthUser {
  id: string;
  username: string;
  roles?: string[] | string;
  plan?: string;
  isPremium?: boolean;
  premiumStatus?: string;
  premiumExpiresAt?: string | null;
  premiumSource?: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  plan: string;
  description: string;
  price: number;
  priceLabel: string;
  currency: string;
  period: string;
  billingCycle: string;
  durationDays: number;
  features: string[];
  badge?: string;
  checkoutReady?: boolean;
}

export interface PremiumInfo {
  isPremium: boolean;
  plan: string;
  premiumStatus: string;
  premiumSource?: string;
  premiumExpiresAt?: string | null;
  provider: string;
  checkoutMode: string;
  currentPlanId?: string;
  currentPlan?: BillingPlan;
  subscription?: {
    provider?: string;
    status?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
  } | null;
  features?: string[];
  billingUrl?: string;
}

export interface LoginChallengeResult {
  kind: 'next';
  step: 'email' | 'cloudCode';
  hasCloudCode?: boolean;
  message?: string;
  devEmailCode?: string;
}

export interface LoginSuccessResult {
  kind: 'success';
  token: string;
  user: AuthUser;
  entryServerId?: string;
  entryTextChannelId?: string;
  entryVoiceChannelId?: string;
}

export type LoginUserResult = LoginSuccessResult | LoginChallengeResult;

export interface ChatSummary {
  id: string;
  type: string;
  name?: string;
  archivedAt?: number;
  members?: Array<{
    userId?: string;
    user?: {
      id?: string;
      username?: string;
      avatarUrl?: string;
    };
  }>;
  lastMessage?: {
    text?: string;
    ciphertext?: string;
    attachmentUrl?: string;
    createdAt?: string;
  };
}

export interface MessageItem {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  ciphertext?: string;
  attachmentUrl?: string;
  createdAt?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  body: string;
  category?: string;
  priority?: string;
  status?: string;
  statusLabel?: string;
  chatId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastReplyAt?: string;
}

export interface ServerSummary {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  iconUrl?: string;
  inviteLink?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerChannel {
  id: string;
  serverId: string;
  categoryId?: string;
  chatId?: string;
  name: string;
  type: 'text' | 'voice' | string;
  position: number;
  createdAt?: string;
}

export interface ServerCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt?: string;
}

export interface ServerMemberRoleBadge {
  id?: string;
  name?: string;
  color?: string;
}

export interface ServerMemberRecord {
  id: string;
  userId: string;
  role: string;
  joinedAt?: string;
  roles?: ServerMemberRoleBadge[];
  user?: {
    id?: string;
    username?: string;
    avatarUrl?: string;
    status?: string;
  };
}

export interface VoiceRoomRecord {
  id: string;
  chatId: string;
  createdBy: string;
  isActive: boolean;
  createdAt?: string;
}

export interface ServerRoleRecord {
  id: string;
  serverId?: string;
  name: string;
  color?: string;
  position?: number;
  permissions?: string[];
  createdAt?: string;
}

export interface MemberEventRecord {
  id: string;
  scopeType: string;
  scopeId: string;
  userId: string;
  actorID?: string;
  actorId?: string;
  action: string;
  details?: string;
  createdAt?: string;
}

export interface AdminTwoFactorStatus {
  twoFactorEnabled: boolean;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email?: string;
  roles?: string[] | string;
  plan?: string;
  status?: string;
  avatarUrl?: string;
  createdAt?: string;
  lastSeen?: string;
}

export interface AdminSystemHealth {
  status: string;
  services: Array<{
    name: string;
    status: string;
    uptime?: number;
  }>;
}

export interface AdminStatsSnapshot {
  users: number;
  chats: number;
  messages: number;
  servers: number;
  online: number;
}

export interface AdminAnalyticsPoint {
  date: string;
  messages: number;
  newUsers: number;
}

export interface AdminAnalyticsSummary {
  range: string;
  users: number;
  messages: number;
  activeUsers: number;
  chart: AdminAnalyticsPoint[];
}

export interface AdminPremiumDashboard {
  totalUsers: number;
  premiumUsers: number;
  conversion: number;
  churnRate: number;
  revenue: number;
  range: string;
}

export interface AdminBanRecord {
  id: string;
  userId: string;
  username?: string;
  reason?: string;
  bannedBy?: string;
  bannedAt?: number;
  expiresAt?: number | null;
  permanent?: boolean;
  active?: boolean;
}

export interface AdminBannedWordRecord {
  id: string;
  phrase: string;
  isRegex?: boolean;
  action?: string;
  scope?: string;
  active?: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface AdminMaintenanceStatus {
  enabled?: boolean;
  isActive?: boolean;
  id?: string;
  timestamp?: string;
  message?: string;
  createdAt?: string;
}

export interface AdminSystemBannerStatus {
  enabled?: boolean;
  isActive?: boolean;
  id?: string;
  title?: string;
  message?: string;
  severity?: string;
  dismissible?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminFeedbackTicket extends SupportTicket {
  contactEmail?: string;
  resolvedAt?: string;
  lastMessageAt?: string;
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
}

export interface UploadAttachmentInput {
  uri: string;
  name?: string;
  type?: string;
}

export interface UploadAttachmentResult {
  attachmentUrl: string;
  name?: string;
  size?: number;
}

export function normalizeApiBase(input?: string | null): string {
  const candidate = (input || '').trim();
  if (!candidate) return DEFAULT_API_BASE;
  const noTrailing = candidate.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(noTrailing)) {
    return DEFAULT_API_BASE;
  }
  return noTrailing;
}

export async function getSavedApiBase(): Promise<string> {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.apiBase);
  return normalizeApiBase(saved);
}

export async function saveApiBase(apiBase: string): Promise<string> {
  const normalized = normalizeApiBase(apiBase);
  await AsyncStorage.setItem(STORAGE_KEYS.apiBase, normalized);
  return normalized;
}

function resolveApiAssetUrl(apiBase: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = normalizeApiBase(apiBase);
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function getFileNameFromUri(uri: string): string {
  const normalized = uri.replace(/\\/g, '/');
  const chunks = normalized.split('/');
  const last = chunks[chunks.length - 1];
  return last || `file_${Date.now()}`;
}

async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function humanizeApiError(status: number, data: any): string {
  const errorCode = data?.error || data?.message || '';
  if (errorCode === 'bad_creds') return 'Invalid username or password';
  if (errorCode === 'user_exists') return 'Username already exists';
  if (errorCode === 'email_exists') return 'Email already exists';
  if (errorCode === 'invalid_email_code') return 'Invalid email verification code';
  if (errorCode === 'invalid_cloud_code') return 'Invalid cloud code';
  if (errorCode === 'invalid_code') return 'Invalid two-factor code';
  if (errorCode === '2fa_required') return 'Enable two-factor authentication before opening staff tools';
  if (errorCode === 'admin_2fa_verify_required') return 'Staff verification required';
  if (errorCode === 'user_suspended') return 'This account is temporarily suspended';
  if (errorCode === 'user_banned') return 'This account is blocked';
  if (errorCode === 'already_member') return 'Already joined';
  if (errorCode === 'owner_cannot_leave') return 'Owner cannot leave this server';
  if (errorCode === 'room_exists') return 'Voice room is already active';
  if (errorCode === 'invalid_link') return 'Invalid invite link';
  if (errorCode === 'forbidden') return 'Access forbidden';
  if (errorCode === 'not_found') return 'Not found';
  if (errorCode === 'too_many_requests') return 'Too many requests, try again later';
  if (status >= 500) return 'Server error';
  if (typeof errorCode === 'string' && errorCode) return errorCode;
  return `HTTP_${status}`;
}

export async function apiRequest<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: any;
    token?: string | null;
    apiBase?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const apiBase = normalizeApiBase(options.apiBase || (await getSavedApiBase()));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(humanizeApiError(response.status, data));
  }
  return data as T;
}

export async function getSavedAdmin2FAToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.admin2FAToken);
}

export async function saveAdmin2FAToken(token: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.admin2FAToken, token);
}

export async function clearAdmin2FAToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.admin2FAToken);
}

async function adminApiRequest<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: any;
    token: string;
    admin2FAToken: string;
    apiBase?: string;
  }
): Promise<T> {
  return apiRequest<T>(path, {
    method: options.method,
    body: options.body,
    token: options.token,
    apiBase: options.apiBase,
    headers: {
      'X-Admin-2FA-Token': options.admin2FAToken,
    },
  });
}

export async function registerUser(
  apiBase: string,
  username: string,
  password: string
): Promise<void> {
  await apiRequest('/api/auth/register', {
    method: 'POST',
    body: { username, password },
    apiBase,
  });
}

export async function loginUser(
  apiBase: string,
  username: string,
  password: string,
  options: {
    emailCode?: string;
    cloudCode?: string;
  } = {}
): Promise<LoginUserResult> {
  const data = await apiRequest<any>('/api/auth/login', {
    method: 'POST',
    body: {
      username,
      password,
      ...(options.emailCode ? { emailCode: options.emailCode } : {}),
      ...(options.cloudCode ? { cloudCode: options.cloudCode } : {}),
    },
    apiBase,
  });

  if (data?.token && data?.user) {
    return {
      kind: 'success',
      token: data.token,
      user: data.user as AuthUser,
      entryServerId: typeof data?.entryServerId === 'string' ? data.entryServerId : undefined,
      entryTextChannelId: typeof data?.entryTextChannelId === 'string' ? data.entryTextChannelId : undefined,
      entryVoiceChannelId: typeof data?.entryVoiceChannelId === 'string' ? data.entryVoiceChannelId : undefined,
    };
  }

  if (data?.error === 'email_verification_required') {
    return {
      kind: 'next',
      step: 'email',
      hasCloudCode: Boolean(data?.hasCloudCode),
      message: typeof data?.message === 'string' ? data.message : undefined,
    };
  }

  if (data?.error === 'cloud_code_required') {
    return {
      kind: 'next',
      step: 'cloudCode',
      hasCloudCode: true,
      message: typeof data?.message === 'string' ? data.message : undefined,
    };
  }

  throw new Error(data?.error || 'login_failed');
}

export async function sendLoginEmailCode(
  apiBase: string,
  username: string
): Promise<{ hasCloudCode?: boolean; code?: string }> {
  const data = await apiRequest<any>('/api/auth/send-login-email-code', {
    method: 'POST',
    body: { username },
    apiBase,
  });

  return {
    hasCloudCode: Boolean(data?.hasCloudCode),
    code: typeof data?.code === 'string' ? data.code : undefined,
  };
}

export async function getCurrentUser(apiBase: string, token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/api/users/me', {
    method: 'GET',
    token,
    apiBase,
  });
}

export async function getPremiumInfo(apiBase: string, token: string): Promise<PremiumInfo> {
  return apiRequest<PremiumInfo>('/api/premium', {
    method: 'GET',
    token,
    apiBase,
  });
}

export async function getBillingPlans(apiBase: string): Promise<BillingPlan[]> {
  const data = await apiRequest<{ plans?: BillingPlan[] }>('/api/plans', {
    method: 'GET',
    apiBase,
  });
  return data.plans || [];
}

export async function checkoutPremium(
  apiBase: string,
  token: string,
  planId: string,
  links?: {
    successUrl?: string;
    cancelUrl?: string;
  }
): Promise<{
  ok?: boolean;
  activated?: boolean;
  provider?: string;
  checkoutMode?: string;
  checkoutUrl?: string;
  premiumExpiresAt?: string | null;
}> {
  return apiRequest('/api/premium/checkout', {
    method: 'POST',
    token,
    apiBase,
    body: {
      planId,
      ...(links?.successUrl ? { successUrl: links.successUrl } : {}),
      ...(links?.cancelUrl ? { cancelUrl: links.cancelUrl } : {}),
    },
  });
}

export async function getChats(
  apiBase: string,
  token: string,
  options: {
    includeArchived?: boolean;
  } = {}
): Promise<ChatSummary[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (options.includeArchived) {
    params.set('includeArchived', 'true');
  }
  const data = await apiRequest<{ chats?: ChatSummary[] }>(`/api/chats?${params.toString()}`, {
    method: 'GET',
    token,
    apiBase,
  });
  return data.chats || [];
}

export async function getServers(apiBase: string, token: string): Promise<ServerSummary[]> {
  const data = await apiRequest<{ servers?: ServerSummary[] }>('/api/servers', {
    method: 'GET',
    token,
    apiBase,
  });
  return data.servers || [];
}

export async function getServer(apiBase: string, token: string, serverId: string): Promise<ServerSummary> {
  const data = await apiRequest<{ server: ServerSummary }>(`/api/servers/${encodeURIComponent(serverId)}`, {
    method: 'GET',
    token,
    apiBase,
  });
  return data.server;
}

export async function createServer(
  apiBase: string,
  token: string,
  payload: {
    name: string;
    description?: string;
  }
): Promise<ServerSummary> {
  const data = await apiRequest<{ server: ServerSummary }>('/api/servers', {
    method: 'POST',
    token,
    apiBase,
    body: payload,
  });
  return data.server;
}

export async function getServerChannels(
  apiBase: string,
  token: string,
  serverId: string
): Promise<ServerChannel[]> {
  const data = await apiRequest<{ channels?: ServerChannel[] }>(`/api/servers/${encodeURIComponent(serverId)}/channels`, {
    method: 'GET',
    token,
    apiBase,
  });
  return data.channels || [];
}

export async function createServerChannel(
  apiBase: string,
  token: string,
  serverId: string,
  payload: {
    name: string;
    type?: 'text' | 'voice';
    position?: number;
  }
): Promise<ServerChannel> {
  const data = await apiRequest<{ channel: ServerChannel }>(`/api/servers/${encodeURIComponent(serverId)}/channels`, {
    method: 'POST',
    token,
    apiBase,
    body: payload,
  });
  return data.channel;
}

export async function deleteServerChannel(
  apiBase: string,
  token: string,
  serverId: string,
  channelId: string
): Promise<void> {
  await apiRequest(`/api/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}`, {
    method: 'DELETE',
    token,
    apiBase,
  });
}

export async function getServerCategories(
  apiBase: string,
  token: string,
  serverId: string
): Promise<ServerCategory[]> {
  const data = await apiRequest<{ categories?: ServerCategory[] }>(`/api/servers/${encodeURIComponent(serverId)}/categories`, {
    method: 'GET',
    token,
    apiBase,
  });
  return data.categories || [];
}

export async function createServerCategory(
  apiBase: string,
  token: string,
  serverId: string,
  payload: {
    name: string;
    position?: number;
  }
): Promise<ServerCategory> {
  const data = await apiRequest<{ category: ServerCategory }>(`/api/servers/${encodeURIComponent(serverId)}/categories`, {
    method: 'POST',
    token,
    apiBase,
    body: payload,
  });
  return data.category;
}

export async function deleteServerCategory(
  apiBase: string,
  token: string,
  serverId: string,
  categoryId: string
): Promise<void> {
  await apiRequest(`/api/servers/${encodeURIComponent(serverId)}/categories/${encodeURIComponent(categoryId)}`, {
    method: 'DELETE',
    token,
    apiBase,
  });
}

export async function setServerChannelCategory(
  apiBase: string,
  token: string,
  serverId: string,
  channelId: string,
  categoryId?: string
): Promise<void> {
  await apiRequest(`/api/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}/category`, {
    method: 'PATCH',
    token,
    apiBase,
    body: {
      categoryId: categoryId || '',
    },
  });
}

export async function getServerMembers(
  apiBase: string,
  token: string,
  serverId: string
): Promise<ServerMemberRecord[]> {
  const data = await apiRequest<{ members?: ServerMemberRecord[] }>(`/api/servers/${encodeURIComponent(serverId)}/members`, {
    method: 'GET',
    token,
    apiBase,
  });
  return data.members || [];
}

export async function addServerMembersBulk(
  apiBase: string,
  token: string,
  serverId: string,
  userIds: string[]
): Promise<{ ok?: boolean; added?: number }> {
  return apiRequest(`/api/servers/${encodeURIComponent(serverId)}/members/bulk`, {
    method: 'POST',
    token,
    apiBase,
    body: { userIds },
  });
}

export async function getServerVoiceState(
  apiBase: string,
  token: string,
  serverId: string
): Promise<Record<string, string[]>> {
  const data = await apiRequest<{ voiceState?: Record<string, string[]> }>(`/api/servers/${encodeURIComponent(serverId)}/voice-state`, {
    method: 'GET',
    token,
    apiBase,
  });
  return data.voiceState || {};
}

export async function leaveServer(apiBase: string, token: string, serverId: string): Promise<void> {
  await apiRequest(`/api/servers/${encodeURIComponent(serverId)}/leave`, {
    method: 'POST',
    token,
    apiBase,
  });
}

export async function updateServer(
  apiBase: string,
  token: string,
  serverId: string,
  payload: {
    name?: string;
    description?: string;
    iconUrl?: string;
  }
): Promise<ServerSummary> {
  const data = await apiRequest<{ server: ServerSummary }>(`/api/servers/${encodeURIComponent(serverId)}`, {
    method: 'PATCH',
    token,
    apiBase,
    body: payload,
  });
  return data.server;
}

export async function generateServerInviteLink(
  apiBase: string,
  token: string,
  serverId: string
): Promise<{ inviteLink?: string; url?: string; emailQueued?: boolean }> {
  return apiRequest(`/api/servers/${encodeURIComponent(serverId)}/invite-link`, {
    method: 'POST',
    token,
    apiBase,
    body: {},
  });
}

export async function joinServerByInvite(
  apiBase: string,
  token: string,
  inviteLink: string
): Promise<{ server?: ServerSummary; message?: string }> {
  return apiRequest(`/api/servers/join/${encodeURIComponent(inviteLink)}`, {
    method: 'POST',
    token,
    apiBase,
  });
}

export async function getServerRoles(
  apiBase: string,
  token: string,
  serverId: string
): Promise<{ roles: ServerRoleRecord[]; allPermissions: string[] }> {
  const data = await apiRequest<{ roles?: ServerRoleRecord[]; allPermissions?: string[] }>(`/api/servers/${encodeURIComponent(serverId)}/roles`, {
    method: 'GET',
    token,
    apiBase,
  });
  return {
    roles: data.roles || [],
    allPermissions: data.allPermissions || [],
  };
}

export async function createServerRole(
  apiBase: string,
  token: string,
  serverId: string,
  payload: {
    name: string;
    color?: string;
    permissions?: string[];
  }
): Promise<ServerRoleRecord> {
  const data = await apiRequest<{ role: ServerRoleRecord }>(`/api/servers/${encodeURIComponent(serverId)}/roles`, {
    method: 'POST',
    token,
    apiBase,
    body: payload,
  });
  return data.role;
}

export async function updateServerRole(
  apiBase: string,
  token: string,
  serverId: string,
  roleId: string,
  payload: {
    name?: string;
    color?: string;
    position?: number;
    permissions?: string[];
  }
): Promise<ServerRoleRecord> {
  const data = await apiRequest<{ role: ServerRoleRecord }>(
    `/api/servers/${encodeURIComponent(serverId)}/roles/${encodeURIComponent(roleId)}`,
    {
      method: 'PATCH',
      token,
      apiBase,
      body: payload,
    }
  );
  return data.role;
}

export async function deleteServerRole(
  apiBase: string,
  token: string,
  serverId: string,
  roleId: string
): Promise<void> {
  await apiRequest(`/api/servers/${encodeURIComponent(serverId)}/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
    token,
    apiBase,
  });
}

export async function setServerMemberRole(
  apiBase: string,
  token: string,
  serverId: string,
  userId: string,
  role: 'owner' | 'admin' | 'moderator' | 'member'
): Promise<void> {
  await apiRequest(`/api/servers/${encodeURIComponent(serverId)}/members/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    token,
    apiBase,
    body: { role },
  });
}

export async function setServerMemberRoles(
  apiBase: string,
  token: string,
  serverId: string,
  userId: string,
  roleIds: string[]
): Promise<void> {
  await apiRequest(`/api/servers/${encodeURIComponent(serverId)}/members/${encodeURIComponent(userId)}/roles`, {
    method: 'PUT',
    token,
    apiBase,
    body: { roleIds },
  });
}

export async function getServerHistory(
  apiBase: string,
  token: string,
  serverId: string
): Promise<MemberEventRecord[]> {
  const data = await apiRequest<{ events?: MemberEventRecord[] }>(`/api/servers/${encodeURIComponent(serverId)}/history`, {
    method: 'GET',
    token,
    apiBase,
  });
  return data.events || [];
}

export async function createVoiceRoom(
  apiBase: string,
  token: string,
  chatId: string
): Promise<VoiceRoomRecord> {
  const data = await apiRequest<{ room: VoiceRoomRecord }>(`/api/chats/${encodeURIComponent(chatId)}/voice-room`, {
    method: 'POST',
    token,
    apiBase,
  });
  return data.room;
}

export async function getVoiceRoom(
  apiBase: string,
  token: string,
  chatId: string
): Promise<VoiceRoomRecord | null> {
  try {
    const data = await apiRequest<{ room: VoiceRoomRecord }>(`/api/chats/${encodeURIComponent(chatId)}/voice-room`, {
      method: 'GET',
      token,
      apiBase,
    });
    return data.room || null;
  } catch (error: any) {
    if (String(error?.message || error) === 'Not found') {
      return null;
    }
    throw error;
  }
}

export async function endVoiceRoom(
  apiBase: string,
  token: string,
  roomId: string
): Promise<void> {
  await apiRequest(`/api/voice-rooms/${encodeURIComponent(roomId)}/end`, {
    method: 'POST',
    token,
    apiBase,
  });
}

export async function archiveChat(
  apiBase: string,
  token: string,
  chatId: string
): Promise<void> {
  await apiRequest(`/api/chats/${encodeURIComponent(chatId)}/archive`, {
    method: 'POST',
    token,
    apiBase,
  });
}

export async function unarchiveChat(
  apiBase: string,
  token: string,
  chatId: string
): Promise<void> {
  await apiRequest(`/api/chats/${encodeURIComponent(chatId)}/unarchive`, {
    method: 'POST',
    token,
    apiBase,
  });
}

export async function searchUsers(
  apiBase: string,
  token: string,
  query: string
): Promise<Array<{ id: string; username: string }>> {
  const data = await apiRequest<{ users?: Array<{ id: string; username: string }> }>(
    `/api/users/search?q=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      token,
      apiBase,
    }
  );
  return data.users || [];
}

export async function createDm(
  apiBase: string,
  token: string,
  peerUserId: string
): Promise<ChatSummary> {
  return apiRequest<ChatSummary>('/api/chats', {
    method: 'POST',
    token,
    apiBase,
    body: {
      type: 'dm',
      memberIds: [peerUserId],
    },
  });
}

export async function getMessages(
  apiBase: string,
  token: string,
  chatId: string
): Promise<MessageItem[]> {
  const data = await apiRequest<{ messages?: MessageItem[] }>(
    `/api/chats/${chatId}/messages?limit=200`,
    {
      method: 'GET',
      token,
      apiBase,
    }
  );
  return data.messages || [];
}

export async function deleteChat(
  apiBase: string,
  token: string,
  chatId: string
): Promise<void> {
  await apiRequest(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: 'DELETE',
    token,
    apiBase,
  });
}

export async function sendMessage(
  apiBase: string,
  token: string,
  payload: {
    chatId: string;
    text?: string;
    ciphertext?: string;
    attachmentUrl?: string;
    expiresMs?: number;
  }
): Promise<MessageItem> {
  return apiRequest<MessageItem>('/api/messages', {
    method: 'POST',
    token,
    apiBase,
    body: payload,
  });
}

export async function getSupportTickets(apiBase: string, token: string): Promise<SupportTicket[]> {
  const data = await apiRequest<{ tickets?: SupportTicket[] }>('/api/feedback', {
    method: 'GET',
    token,
    apiBase,
  });
  return data.tickets || [];
}

export async function createSupportTicket(
  apiBase: string,
  token: string,
  payload: {
    subject: string;
    body: string;
    category?: string;
    priority?: string;
    contactEmail?: string;
  }
): Promise<{ ok?: boolean; id?: string; chatId?: string; ticket?: SupportTicket }> {
  return apiRequest('/api/feedback', {
    method: 'POST',
    token,
    apiBase,
    body: payload,
  });
}

export async function uploadAttachment(
  apiBase: string,
  token: string,
  chatId: string,
  input: UploadAttachmentInput
): Promise<UploadAttachmentResult> {
  if (!input?.uri) {
    throw new Error('file_uri_required');
  }

  const normalizedApiBase = normalizeApiBase(apiBase);
  const formData = new FormData();
  formData.append('file', {
    uri: input.uri,
    name: input.name?.trim() || getFileNameFromUri(input.uri),
    type: input.type || 'application/octet-stream',
  } as any);

  const response = await fetch(
    `${normalizedApiBase}/api/chats/${encodeURIComponent(chatId)}/attach`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(humanizeApiError(response.status, data));
  }

  const attachmentRaw =
    typeof data?.attachmentUrl === 'string' && data.attachmentUrl.trim()
      ? data.attachmentUrl.trim()
      : typeof data?.url === 'string' && data.url.trim()
      ? data.url.trim()
      : '';

  if (!attachmentRaw) {
    throw new Error('upload_failed');
  }

  return {
    attachmentUrl: resolveApiAssetUrl(normalizedApiBase, attachmentRaw),
    name: typeof data?.name === 'string' ? data.name : undefined,
    size: typeof data?.size === 'number' ? data.size : undefined,
  };
}

export async function getAdmin2FAStatus(apiBase: string, token: string): Promise<AdminTwoFactorStatus> {
  return apiRequest<AdminTwoFactorStatus>('/api/admin/2fa-status', {
    method: 'GET',
    token,
    apiBase,
  });
}

export async function verifyAdmin2FA(
  apiBase: string,
  token: string,
  code: string
): Promise<{ ok?: boolean; token: string }> {
  return apiRequest('/api/admin/verify-2fa', {
    method: 'POST',
    token,
    apiBase,
    body: { code },
  });
}

export async function getAdminUsers(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  options: {
    search?: string;
    plan?: string;
  } = {}
): Promise<AdminUserRecord[]> {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set('search', options.search.trim());
  if (options.plan?.trim()) params.set('plan', options.plan.trim());
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await adminApiRequest<{ users?: AdminUserRecord[] }>(`/api/admin/users${suffix}`, {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
  return data.users || [];
}

export async function blockAdminUser(apiBase: string, token: string, admin2FAToken: string, userId: string): Promise<void> {
  await adminApiRequest(`/api/admin/users/${encodeURIComponent(userId)}/block`, {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function unblockAdminUser(apiBase: string, token: string, admin2FAToken: string, userId: string): Promise<void> {
  await adminApiRequest(`/api/admin/users/${encodeURIComponent(userId)}/unblock`, {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function suspendAdminUser(apiBase: string, token: string, admin2FAToken: string, userId: string): Promise<void> {
  await adminApiRequest(`/api/admin/users/${encodeURIComponent(userId)}/suspend`, {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function unsuspendAdminUser(apiBase: string, token: string, admin2FAToken: string, userId: string): Promise<void> {
  await adminApiRequest(`/api/admin/users/${encodeURIComponent(userId)}/unsuspend`, {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminFeedback(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  options: {
    status?: string;
  } = {}
): Promise<AdminFeedbackTicket[]> {
  const params = new URLSearchParams();
  if (options.status?.trim()) params.set('status', options.status.trim());
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await adminApiRequest<{ tickets?: AdminFeedbackTicket[] }>(`/api/admin/feedback${suffix}`, {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
  return data.tickets || [];
}

export async function patchAdminFeedback(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  ticketId: string,
  status: string
): Promise<AdminFeedbackTicket | null> {
  const data = await adminApiRequest<{ ticket?: AdminFeedbackTicket }>(`/api/admin/feedback/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    token,
    admin2FAToken,
    apiBase,
    body: { status },
  });
  return data.ticket || null;
}

export async function getAdminMaintenance(apiBase: string, token: string, admin2FAToken: string): Promise<AdminMaintenanceStatus> {
  return adminApiRequest<AdminMaintenanceStatus>('/api/admin/maintenance', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function setAdminMaintenance(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  payload: {
    timestamp: string;
    message: string;
    sendEmail?: boolean;
  }
): Promise<any> {
  return adminApiRequest('/api/admin/maintenance', {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
    body: payload,
  });
}

export async function disableAdminMaintenance(apiBase: string, token: string, admin2FAToken: string): Promise<void> {
  await adminApiRequest('/api/admin/maintenance/disable', {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminSystemBanner(apiBase: string, token: string, admin2FAToken: string): Promise<AdminSystemBannerStatus> {
  return adminApiRequest<AdminSystemBannerStatus>('/api/admin/system-banner', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function setAdminSystemBanner(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  payload: {
    title?: string;
    message: string;
    severity?: string;
    dismissible?: boolean;
    startsAt?: string;
    endsAt?: string;
  }
): Promise<any> {
  return adminApiRequest('/api/admin/system-banner', {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
    body: payload,
  });
}

export async function disableAdminSystemBanner(apiBase: string, token: string, admin2FAToken: string): Promise<void> {
  await adminApiRequest('/api/admin/system-banner/disable', {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminSystemHealth(apiBase: string, token: string, admin2FAToken: string): Promise<AdminSystemHealth> {
  return adminApiRequest<AdminSystemHealth>('/api/admin/system/health', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminStats(apiBase: string, token: string, admin2FAToken: string): Promise<AdminStatsSnapshot> {
  const data = await adminApiRequest<{ stats?: AdminStatsSnapshot }>('/api/admin/stats', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
  return data.stats || { users: 0, chats: 0, messages: 0, servers: 0, online: 0 };
}

export async function getAdminAnalytics(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  range: '24h' | '7d' | '30d' = '7d'
): Promise<AdminAnalyticsSummary> {
  return adminApiRequest<AdminAnalyticsSummary>(`/api/admin/analytics?range=${encodeURIComponent(range)}`, {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminPremiumDashboard(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  range: '7d' | '30d' | '90d' = '30d'
): Promise<AdminPremiumDashboard> {
  return adminApiRequest<AdminPremiumDashboard>(`/api/admin/analytics/premium-dashboard?range=${encodeURIComponent(range)}`, {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminReports(apiBase: string, token: string, admin2FAToken: string): Promise<any[]> {
  return adminApiRequest<any[]>('/api/admin/reports', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminModQueue(apiBase: string, token: string, admin2FAToken: string): Promise<any[]> {
  return adminApiRequest<any[]>('/api/admin/modqueue', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminBans(
  apiBase: string,
  token: string,
  admin2FAToken: string
): Promise<AdminBanRecord[]> {
  const data = await adminApiRequest<{ bans?: AdminBanRecord[] }>('/api/admin/bans', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
  return data.bans || [];
}

export async function createAdminBan(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  payload: {
    userId: string;
    reason?: string;
    permanent?: boolean;
    expiresAt?: number;
  }
): Promise<{ ok?: boolean; id?: string }> {
  return adminApiRequest('/api/admin/bans', {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
    body: payload,
  });
}

export async function deleteAdminBan(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  banIdOrUserId: string
): Promise<void> {
  await adminApiRequest(`/api/admin/bans/${encodeURIComponent(banIdOrUserId)}`, {
    method: 'DELETE',
    token,
    admin2FAToken,
    apiBase,
  });
}

export async function getAdminBannedWords(
  apiBase: string,
  token: string,
  admin2FAToken: string
): Promise<AdminBannedWordRecord[]> {
  const data = await adminApiRequest<{ list?: AdminBannedWordRecord[] }>('/api/admin/banned-words', {
    method: 'GET',
    token,
    admin2FAToken,
    apiBase,
  });
  return data.list || [];
}

export async function createAdminBannedWord(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  payload: {
    phrase: string;
    isRegex?: boolean;
    action: string;
    scope?: string;
  }
): Promise<{ item?: Partial<AdminBannedWordRecord> }> {
  return adminApiRequest('/api/admin/banned-words', {
    method: 'POST',
    token,
    admin2FAToken,
    apiBase,
    body: payload,
  });
}

export async function patchAdminBannedWord(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  itemId: string,
  payload: {
    active?: boolean;
    action?: string;
  }
): Promise<void> {
  await adminApiRequest(`/api/admin/banned-words/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    token,
    admin2FAToken,
    apiBase,
    body: payload,
  });
}

export async function deleteAdminBannedWord(
  apiBase: string,
  token: string,
  admin2FAToken: string,
  itemId: string
): Promise<void> {
  await adminApiRequest(`/api/admin/banned-words/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    token,
    admin2FAToken,
    apiBase,
  });
}
