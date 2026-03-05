
const SAFEGRAM_API_SERVER = 'https://141.8.198.152.nip.io';
const FALLBACK_API = SAFEGRAM_API_SERVER;

function normalizeBaseUrl(url: string): string {
  const u = url.replace(/\/+$/, '');
  if (!u) return FALLBACK_API;
  if (!/^https?:\/\//i.test(u)) return FALLBACK_API;
  try {
    const parsed = new URL(u);
    if (!parsed.hostname || parsed.hostname === '') return FALLBACK_API;
    return u;
  } catch {
    return FALLBACK_API;
  }
}

const DEFAULT_API = normalizeBaseUrl(
  typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL.trim() !== ''
    ? import.meta.env.VITE_API_URL.trim()
    : SAFEGRAM_API_SERVER
);

// Runtime config из /config.json (для деплоя на Vercel при API на своём ПК)
let runtimeApiUrl: string | null = null;

declare global {
  interface Window {
    electronAPI?: {
      getConfig: () => Promise<{ serverUrl?: string; [k: string]: unknown }>;
      showNotification: (opts: { title: string; body: string; icon?: string; silent?: boolean }) => Promise<unknown>;
      openExternal?: (url: string) => Promise<void>;
    };
  }
}

/** Загрузить config.json (apiUrl или apiHost) и, в десктопе, serverUrl из Electron store. Десктоп не зависит от config.json — сразу берёт URL из store. */
export function loadApiConfig(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const isDesktop = !!(window as any).electronAPI;
  if (isDesktop) {
    return (window as any).electronAPI.getConfig().then((c: { serverUrl?: string }) => {
      if (c?.serverUrl && String(c.serverUrl).trim()) runtimeApiUrl = normalizeBaseUrl(String(c.serverUrl).trim());
      else runtimeApiUrl = SAFEGRAM_API_SERVER;
    }).catch(() => { runtimeApiUrl = SAFEGRAM_API_SERVER; });
  }
  return fetch('/config.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((o: { apiUrl?: string; apiHost?: string } | null) => {
      if (!o) return;
      const url = typeof o.apiUrl === 'string' && o.apiUrl.trim() ? o.apiUrl.trim()
        : typeof o.apiHost === 'string' && o.apiHost.trim() ? o.apiHost.trim() : '';
      if (url) runtimeApiUrl = normalizeBaseUrl(url);
    })
    .catch(() => {});
}

/** Базовый URL для запросов. Всегда возвращает валидный http(s) URL с хостом. */
export function getApiBaseUrl(): string {
  const w = typeof window !== 'undefined' ? window : null;
  const isDesktop = w && (w as any).electronAPI;
  if (isDesktop && runtimeApiUrl == null) return SAFEGRAM_API_SERVER;
  const proxy = w ? (localStorage.getItem('safegram_proxy_url') || '').trim() : '';
  return normalizeBaseUrl(runtimeApiUrl || proxy || DEFAULT_API);
}

const API = DEFAULT_API;

/** Превращает технические сообщения об ошибках в понятные пользователю. */
export function humanFriendlyMessage(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'Что-то пошло не так. Попробуйте ещё раз.';
  const s = raw.toLowerCase();
  if (/failed to fetch|network request failed|load failed|networkerror/i.test(s)) return 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';
  if (/511|network authentication required/i.test(s)) return 'Сеть требует авторизации (каптив-портал). Откройте в браузере новую вкладку, войдите в Wi‑Fi или примите условия сети, затем обновите страницу.';
  if (/timeout|timed out/i.test(s)) return 'Сервер не ответил вовремя. Попробуйте позже.';
  if (/511|network authentication required/i.test(s)) return 'Туннель (loca.lt) требует подтверждения: откройте ссылку API в новой вкладке, нажмите «Продолжить», затем обновите страницу.';
  if (/403|forbidden/i.test(s)) return 'Доступ запрещён.';
  if (/404|not found/i.test(s)) return 'Не найдено.';
  if (/500|internal server|server_error/i.test(s)) return 'Временная ошибка на сервере. Попробуйте позже.';
  if (/failed|error|tech|exception/i.test(s) && s.length < 80) return 'Что-то пошло не так. Попробуйте ещё раз.';
  return raw.length > 120 ? 'Что-то пошло не так. Попробуйте ещё раз.' : raw;
}

/** Сообщение об ошибке для показа пользователю (из любого throw/catch). */
export function getErrorMessage(e: unknown, fallback = 'Что-то пошло не так. Попробуйте ещё раз.'): string {
  const msg = (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string')
    ? (e as any).message : '';
  return humanFriendlyMessage(msg) || fallback;
}

// Кэш для GET запросов
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5000; // 5 секунд для чатов/серверов
const USER_ME_CACHE_TTL = 30_000; // 30 секунд для /api/users/me, чтобы не лимитило

// Очередь запросов для предотвращения дублирования
const pendingRequests = new Map<string, Promise<any>>();

// Функция для задержки (exponential backoff)
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для проверки, нужно ли кэшировать запрос
function shouldCache(path: string, method: string): boolean {
  return method === 'GET' && (
    path.includes('/api/users/me') ||
    path.includes('/api/chats') ||
    path.includes('/api/servers')
  );
}

// Функция для проверки, нужно ли игнорировать 404
function shouldIgnore404(path: string): boolean {
  return path.includes('/api/bots') ||
         path.includes('/api/contacts/list') ||
         path.includes('/api/admin/analytics') ||
         path.includes('/api/admin/bans') ||
         path.includes('/api/admin/logs') ||
         path.includes('/api/admin/modqueue') ||
         path.includes('/api/admin/reports');
}

export async function api(path: string, method: string = 'GET', body?: any, retries: number = 3): Promise<any> {
  const cacheKey = `${method}:${path}`;
  
  // Проверяем кэш для GET запросов
  if (shouldCache(path, method)) {
    const cached = cache.get(cacheKey);
    const ttl = path.includes('/api/users/me') && !path.includes('/users/me/') ? USER_ME_CACHE_TTL : CACHE_TTL;
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
  }

  // Проверяем, есть ли уже выполняющийся запрос
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const makeRequest = async (attempt: number = 0): Promise<any> => {
    const token = localStorage.getItem('token');
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const admin2FA = typeof window !== 'undefined' && path.startsWith('/api/admin/') && !path.includes('2fa-status') && !path.includes('verify-2fa')
      ? sessionStorage.getItem('admin_2fa_token')
      : null;
    if (admin2FA) headers['X-Admin-2FA-Token'] = admin2FA;

    const base = getApiBaseUrl();
    // Заголовок Bypass-Tunnel-Reminder ломает CORS при запросах с другого origin (например Vercel → loca.lt).
    // Добавляем только при same-origin (когда фронт и API на одном домене, напр. loca.lt).
    if (base.includes('loca.lt') && typeof window !== 'undefined') {
      try {
        const apiOrigin = new URL(base).origin;
        if (window.location.origin === apiOrigin) {
          headers['Bypass-Tunnel-Reminder'] = 'true';
        }
      } catch {}
    }

    try {
      const rsp = await fetch((base.endsWith('/') ? base.slice(0, -1) : base) + path, { 
        method, 
        headers, 
        body: body ? JSON.stringify(body) : undefined 
      });
      
      // Игнорируем 404 для несуществующих эндпоинтов
      if (rsp.status === 404 && shouldIgnore404(path)) {
        console.warn(`Endpoint not implemented: ${path}`);
        return null; // Возвращаем null вместо ошибки
      }

      // 5xx: повтор с экспоненциальной задержкой (до 2 раз), затем показываем пользователю
      if (rsp.status >= 500 && rsp.status < 600 && attempt < retries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        await delay(delayMs);
        return makeRequest(attempt + 1);
      }

      // 429: не ретраим при блокировке IP; при лимите — не более 1 повтора, чтобы не усугублять
      if (rsp.status === 429) {
        const raw429 = await rsp.text();
        let errCode = '';
        try {
          const j = JSON.parse(raw429 || '{}');
          errCode = j.error || '';
        } catch (_) {}
        if (errCode === 'ip_temporarily_blocked') {
          const e = new Error('IP временно заблокирован. Подождите несколько минут.') as any;
          e.status = 429;
          e.errorCode = errCode;
          throw e;
        }
        const max429Retries = 1;
        if (attempt < max429Retries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(`Rate limited (429), retry once after ${delayMs}ms...`);
          await delay(delayMs);
          return makeRequest(attempt + 1);
        }
        const e = new Error('Слишком много запросов. Подождите минуту.') as any;
        e.status = 429;
        e.errorCode = errCode || 'too_many_requests';
        throw e;
      }

      if (!rsp.ok) {
        let msg = 'Что-то пошло не так. Попробуйте ещё раз.';
        if (rsp.status >= 500 && rsp.status < 600) {
          msg = 'Временная ошибка сервера. Попробуйте через минуту.';
        } else if (rsp.status === 404 && path.startsWith('/api/')) {
          msg = 'Сервер API недоступен. Укажите адрес бэкенда в public/config.json (apiUrl или apiHost) или задайте VITE_API_URL при сборке.';
        }
        if (rsp.status === 511) {
          msg = 'Сеть требует авторизации (каптив-портал). Откройте в браузере новую вкладку, войдите в Wi‑Fi или примите условия сети, затем обновите страницу.';
        }
        let errorCode = '';
        let responseData: any = null;
        const rawText = await rsp.text();
        try {
          const j = rawText ? JSON.parse(rawText) : {};
          responseData = j;
          errorCode = j.error || '';

          if (j.error === 'email_verification_required' || j.error === 'cloud_code_required' ||
              j.error === 'invalid_email_code' || j.error === 'invalid_cloud_code') {
            msg = j.error;
          } else if (j.error === 'bad_request') {
            if (j.detail === 'query_too_short' || j.detail === 'query_empty') msg = 'Введите минимум 2 символа для поиска.';
            else msg = j.detail || 'Некорректный запрос';
          }
          else if (j.error === 'bad_creds') msg = 'Неверный логин или пароль';
          else if (j.error === 'user_exists') msg = 'Этот логин уже занят. Выберите другой.';
          else if (j.error === 'email_exists') msg = 'Эта почта уже привязана к другому аккаунту.';
          else if (j.error === 'email_code_required') msg = 'Введите код из письма.';
          else if (j.error === 'invalid_code' || j.error === 'invalid_email_code') msg = 'Неверный код. Проверьте и введите снова.';
          else if (j.error === 'invalid_cloud_code') msg = 'Неверный облачный код.';
          else if (j.error === 'username_short') msg = j.detail || 'Логин должен содержать минимум 3 символа';
          else if (j.error === 'weak_password') msg = j.detail || 'Пароль должен содержать минимум 4 символа';
          else if (j.error === 'too_many_requests' || j.error === 'too_many_attempts') {
            msg = 'Слишком много запросов. Подождите немного.';
            if (attempt < retries) {
              const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
              await delay(delayMs);
              return makeRequest(attempt + 1);
            }
          } else if (rsp.status === 511) {
            msg = 'Туннель (loca.lt) требует подтверждения: откройте ссылку API в новой вкладке, нажмите «Продолжить», затем обновите страницу.';
          } else if (j.error === 'unauthorized') msg = 'Требуется авторизация';
          else if (j.error === 'server_error') msg = 'Временная ошибка на сервере. Попробуйте позже.';
          else if (j.error === 'cannot_add_self') msg = 'Нельзя добавить себя в контакты';
          else if (j.error === 'user_not_found') msg = 'Пользователь не найден';
          else if (j.error === 'no_email') msg = 'К этому аккаунту не привязана почта. Добавьте email в настройках или обратитесь в поддержку.';
          else if (j.error === 'failed_to_send_email') msg = j.detail || 'Не удалось отправить письмо. Проверьте настройки почты на сервере или попробуйте позже.';
          else if (j.error === 'not_found') {
            if (path.includes('/users/')) msg = 'Пользователь не найден';
            else if (path.includes('/chats/')) msg = 'Чат не найден';
            else if (path.includes('/servers/')) msg = 'Сервер не найден';
            else msg = 'Запрашиваемый объект не найден';
          } else {
            msg = j.detail || j.error || msg;
          }
        } catch (_) {
          if (rsp.status === 511) {
            msg = 'Сеть требует авторизации (каптив-портал). Откройте в браузере новую вкладку, войдите в Wi‑Fi или примите условия сети, затем обновите страницу.';
          } else if (rsp.status === 0 || /failed|network|load|timeout|refused|fetch/i.test(rawText)) {
            msg = 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';
          } else if (rawText && rawText.length < 200) {
            msg = humanFriendlyMessage(rawText);
          }
        }
        const error = new Error(msg) as any;
        error.status = rsp.status;
        error.errorCode = errorCode;
        error.response = responseData; // Сохраняем полный ответ сервера
        throw error;
      }
      
      const data = await rsp.json();
      
      // Кэшируем результат для GET запросов
      if (shouldCache(path, method)) {
        const ttl = path.includes('/api/users/me') && !path.includes('/users/me/') ? USER_ME_CACHE_TTL : CACHE_TTL;
        cache.set(cacheKey, {
          data,
          expires: Date.now() + ttl
        });
      }
      
      return data;
    } catch (error: any) {
      if (attempt < retries && !error.status) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await delay(delayMs);
        return makeRequest(attempt + 1);
      }
      let friendly = humanFriendlyMessage(error?.message || '');
      if (!error?.status && path.startsWith('/api/') && /json|unexpected token|parse/i.test(String(error?.message || ''))) {
        friendly = 'Сервер API недоступен. Укажите адрес бэкенда в public/config.json (apiUrl или apiHost) или VITE_API_URL при сборке.';
      }
      const err = new Error(friendly) as any;
      err.status = error?.status;
      err.errorCode = error?.errorCode;
      err.response = error?.response;
      throw err;
    }
  };

  const requestPromise = makeRequest();
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

// Функция для очистки кэша
export function clearCache(path?: string): void {
  if (path) {
    // Очищаем все записи для этого пути
    for (const key of cache.keys()) {
      if (key.includes(path)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

/** Токен верификации 2FA для входа в админку (хранится в sessionStorage). */
export function setAdmin2FAToken(token: string): void {
  if (typeof window !== 'undefined') sessionStorage.setItem('admin_2fa_token', token);
}
export function clearAdmin2FAToken(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem('admin_2fa_token');
}

/** Для обратной совместимости; при наличии прокси лучше использовать getApiBaseUrl(). */
export const API_URL = DEFAULT_API;
