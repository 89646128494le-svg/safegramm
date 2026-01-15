// Простые smoke-тесты API.
// Запуск: npm run smoke
// BASE_URL можно переопределить переменной окружения: BASE_URL=https://localhost:8080
const BASE = process.env.BASE_URL || 'http://localhost:8080';

const rnd = Math.floor(Math.random() * 1e6);
const username = `demo${rnd}`;
const password = 'Demo1234!';

let token = '';
let chatId = '';

async function req(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return json;
}

async function main() {
  console.log('[smoke] base', BASE);

  // register
  const reg = await req('/api/auth/register', 'POST', { username, password });
  token = reg.token;
  console.log('[smoke] registered', username);

  // me
  const me = await req('/api/users/me');
  console.log('[smoke] me', me.username);

  // create chat
  const chat = await req('/api/chats', 'POST', { type: 'group', name: 'Smoke chat' });
  chatId = chat.chat?.id || chat.id;
  console.log('[smoke] chat', chatId);

  // send message via REST attach (no file) not available; simulate via save message list
  const msgs = await req(`/api/chats/${chatId}/messages`);
  console.log('[smoke] messages count', msgs.messages?.length ?? 0);

  console.log('[smoke] OK');
}

main().catch((e) => {
  console.error('[smoke] FAILED', e.message);
  process.exitCode = 1;
});
