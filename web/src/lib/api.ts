const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8081')
  : 'http://127.0.0.1:8081';

export function getApiBase(): string {
  return API_BASE.replace(/\/+$/, '');
}

/** Session Pinning: один deviceId на устройство, сохраняем из ответов сервера. */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem('deviceId', id);
  }
  return id;
}

export function setDeviceId(id: string): void {
  if (typeof window !== 'undefined' && id) localStorage.setItem('deviceId', id);
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const url = path.startsWith('http') ? path : `${getApiBase()}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (typeof window !== 'undefined') {
    const devId = getOrCreateDeviceId();
    if (devId) headers['X-Device-ID'] = devId;
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let err: Error & { status?: number } = new Error(text || res.statusText);
    err.status = res.status;
    throw err;
  }
  if (res.headers.get('content-type')?.includes('application/json'))
    return res.json() as Promise<T>;
  return undefined as T;
}
