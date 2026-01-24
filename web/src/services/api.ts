
// API URL - используем переменную окружения или localhost по умолчанию
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

// Кэш для GET запросов
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5000; // 5 секунд для часто запрашиваемых данных

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
    
    try {
      const rsp = await fetch(API + path, { 
        method, 
        headers, 
        body: body ? JSON.stringify(body) : undefined 
      });
      
      // Игнорируем 404 для несуществующих эндпоинтов
      if (rsp.status === 404 && shouldIgnore404(path)) {
        console.warn(`Endpoint not implemented: ${path}`);
        return null; // Возвращаем null вместо ошибки
      }

      // Retry для 429 (Too Many Requests) с exponential backoff
      if (rsp.status === 429 && attempt < retries) {
        const retryAfter = rsp.headers.get('Retry-After');
        const delayMs = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
        
        console.warn(`Rate limited (429), retrying after ${delayMs}ms...`);
        await delay(delayMs);
        return makeRequest(attempt + 1);
      }

      if (!rsp.ok) {
        let msg = 'Ошибка запроса';
        let errorCode = '';
        let responseData: any = null;
        try { 
          const j = await rsp.json(); 
          responseData = j;
          errorCode = j.error || '';
          
          // Специальные ошибки для аутентификации - передаём код как есть для обработки в компоненте
          if (j.error === 'email_verification_required' || 
              j.error === 'cloud_code_required' ||
              j.error === 'invalid_email_code' ||
              j.error === 'invalid_cloud_code') {
            msg = j.error; // Передаём код ошибки как message для обработки в Login.tsx
          }
          // Переводим коды ошибок на русский
          else if (j.error === 'bad_request') msg = j.detail || 'Некорректный запрос';
          else if (j.error === 'bad_creds') msg = 'Неверный логин или пароль';
          else if (j.error === 'user_exists') msg = j.detail || 'Пользователь с таким логином уже существует';
          else if (j.error === 'username_short') msg = j.detail || 'Логин должен содержать минимум 3 символа';
          else if (j.error === 'weak_password') msg = j.detail || 'Пароль должен содержать минимум 4 символа';
          else if (j.error === 'too_many_requests' || j.error === 'too_many_attempts') {
            msg = 'Слишком много запросов. Подождите немного.';
            // Для 429 пробуем еще раз, если есть попытки
            if (attempt < retries) {
              const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
              await delay(delayMs);
              return makeRequest(attempt + 1);
            }
          }
          else if (j.error === 'unauthorized') msg = 'Требуется авторизация';
          else if (j.error === 'server_error') msg = 'Ошибка сервера';
          else if (j.error === 'not_found') {
            // Определяем контекст по URL
            if (path.includes('/users/')) msg = 'Пользователь не найден';
            else if (path.includes('/chats/')) msg = 'Чат не найден';
            else if (path.includes('/servers/')) msg = 'Сервер не найден';
            else msg = 'Запрашиваемый объект не найден';
          }
          else {
            // Для остальных ошибок используем detail или error
            msg = j.detail || j.error || msg;
          }
        } catch {}
        const error = new Error(msg) as any;
        error.status = rsp.status;
        error.errorCode = errorCode;
        error.response = responseData; // Сохраняем полный ответ сервера
        throw error;
      }
      
      const data = await rsp.json();
      
      // Кэшируем результат для GET запросов
      if (shouldCache(path, method)) {
        cache.set(cacheKey, {
          data,
          expires: Date.now() + CACHE_TTL
        });
      }
      
      return data;
    } catch (error: any) {
      // Если это ошибка сети и есть попытки, пробуем еще раз
      if (attempt < retries && !error.status) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await delay(delayMs);
        return makeRequest(attempt + 1);
      }
      throw error;
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

export const API_URL = API;
