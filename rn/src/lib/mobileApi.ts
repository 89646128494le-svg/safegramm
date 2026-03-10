import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  token: 'sg_token',
  user: 'sg_user',
  apiBase: 'sg_api_base',
  secureMode: 'sg_secure_mode',
} as const;

const DEFAULT_API_BASE = 'https://141.8.198.152.nip.io';

export interface AuthUser {
  id: string;
  username: string;
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
}

export type LoginUserResult = LoginSuccessResult | LoginChallengeResult;

export interface ChatSummary {
  id: string;
  type: string;
  name?: string;
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
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const apiBase = normalizeApiBase(options.apiBase || (await getSavedApiBase()));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    return { kind: 'success', token: data.token, user: data.user as AuthUser };
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

export async function getChats(apiBase: string, token: string): Promise<ChatSummary[]> {
  const data = await apiRequest<{ chats?: ChatSummary[] }>('/api/chats?limit=100', {
    method: 'GET',
    token,
    apiBase,
  });
  return data.chats || [];
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
