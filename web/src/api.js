
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function api(path, method='GET', body) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const rsp = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await rsp.json().catch(()=>({}));
  if (!rsp.ok) throw new Error(data.error || rsp.statusText || 'api_error');
  return data;
}
