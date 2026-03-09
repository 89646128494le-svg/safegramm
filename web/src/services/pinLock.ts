const PIN_HASH_KEY = 'safegram_local_pin_hash_v1';
const PIN_SALT_KEY = 'safegram_local_pin_salt_v1';

function b64Encode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function b64Decode(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return b64Encode(new Uint8Array(digest));
}

function createSalt(): string {
  const random = crypto.getRandomValues(new Uint8Array(16));
  return b64Encode(random);
}

export function hasLocalPin(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(PIN_HASH_KEY) && !!localStorage.getItem(PIN_SALT_KEY);
}

export async function setLocalPin(pin: string): Promise<void> {
  const normalized = pin.trim();
  if (normalized.length < 4 || normalized.length > 12) {
    throw new Error('PIN от 4 до 12 символов');
  }
  const salt = createSalt();
  const hash = await sha256(`${salt}:${normalized}`);
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
}

export function clearLocalPin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
}

export async function verifyLocalPin(pin: string): Promise<boolean> {
  const salt = localStorage.getItem(PIN_SALT_KEY);
  const expectedHash = localStorage.getItem(PIN_HASH_KEY);
  if (!salt || !expectedHash) return false;
  const actualHash = await sha256(`${salt}:${pin.trim()}`);
  const a = b64Decode(actualHash);
  const b = b64Decode(expectedHash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

