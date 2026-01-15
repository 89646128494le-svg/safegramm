
// API URL - используем переменную окружения или localhost по умолчанию
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export async function api(path: string, method: string = 'GET', body?: any) {
  const token = localStorage.getItem('token');
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const rsp = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!rsp.ok) {
    let msg = 'Ошибка запроса';
    try { 
      const j = await rsp.json(); 
      msg = j.detail || j.error || msg;
      // Переводим коды ошибок на русский
      if (j.error === 'bad_request') msg = j.detail || 'Некорректный запрос';
      else if (j.error === 'bad_creds') msg = 'Неверный логин или пароль';
      else if (j.error === 'user_exists') msg = j.detail || 'Пользователь с таким логином уже существует';
      else if (j.error === 'username_short') msg = j.detail || 'Логин должен содержать минимум 3 символа';
      else if (j.error === 'weak_password') msg = j.detail || 'Пароль должен содержать минимум 4 символа';
      else if (j.error === 'too_many_attempts') msg = 'Слишком много попыток. Попробуйте позже';
      else if (j.error === 'unauthorized') msg = 'Требуется авторизация';
      else if (j.error === 'server_error') msg = 'Ошибка сервера';
      else if (j.error === 'not_found') {
        // Определяем контекст по URL
        if (path.includes('/users/')) msg = 'Пользователь не найден';
        else if (path.includes('/chats/')) msg = 'Чат не найден';
        else if (path.includes('/servers/')) msg = 'Сервер не найден';
        else msg = 'Запрашиваемый объект не найден';
      }
    } catch {}
    throw new Error(msg);
  }
  return rsp.json();
}

export const API_URL = API;
