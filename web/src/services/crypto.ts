
/**
 * SafeGram Shield — E2EE по протоколу из web/src/crypto/E2EE_PROTOCOL.md
 * ECDH P-256 + HKDF (контекст чата) + AES-256-GCM.
 */
import { getApiBaseUrl } from './api';

const HKDF_INFO_DM = 'safegram-dm-v1:';
const HKDF_INFO_GROUP_WRAP = 'safegram-group-wrap-v1:';

function strToBuf(s: string) { return new TextEncoder().encode(s); }

async function importPublicKeyJwk(jwk: JsonWebKey) {
  return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}
async function importPrivateKeyPkcs8(pkcs8: string) {
  const raw = Uint8Array.from(atob(pkcs8), c=>c.charCodeAt(0));
  return await crypto.subtle.importKey('pkcs8', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}
async function exportPublicJwk(key: CryptoKey) { return await crypto.subtle.exportKey('jwk', key); }
async function exportPrivatePkcs8(key: CryptoKey) { const buf = await crypto.subtle.exportKey('pkcs8', key); return btoa(String.fromCharCode(...new Uint8Array(buf))); }

/** KDF по умолчанию (обратная совместимость): SHA-256(sharedSecret) -> AES key */
async function kdf(sharedBits: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', sharedBits);
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt','decrypt']);
}

/** HKDF-SHA256: привязка ключа к контексту (chatId). SafeGram Shield v1. */
async function deriveKeyHKDF(sharedSecretBits: ArrayBuffer, info: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    sharedSecretBits,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: strToBuf(info),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function ensureKeys() {
  let pub = localStorage.getItem('sg_pub');
  let priv = localStorage.getItem('sg_priv');
  if (!pub || !priv) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const pubJwk = await exportPublicJwk(pair.publicKey);
    const privPkcs8 = await exportPrivatePkcs8(pair.privateKey);
    localStorage.setItem('sg_pub', JSON.stringify(pubJwk));
    localStorage.setItem('sg_priv', privPkcs8);
    const token = localStorage.getItem('token');
    await fetch(getApiBaseUrl() + '/api/users/public_key', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ publicKeyJwk: pubJwk }) });
  } else {
    const token = localStorage.getItem('token');
    await fetch(getApiBaseUrl() + '/api/users/public_key', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ publicKeyJwk: JSON.parse(pub) }) });
  }
}

export async function getMyPublicJwk() { return JSON.parse(localStorage.getItem('sg_pub')!); }
export async function getMyPrivateKey() { return await importPrivateKeyPkcs8(localStorage.getItem('sg_priv')!); }

/** Общий ключ для пары (без привязки к чату). Оставлен для совместимости. */
export async function deriveSharedKey(otherPubJwk: any) {
  const myPriv = await getMyPrivateKey();
  const otherPub = await importPublicKeyJwk(otherPubJwk);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: otherPub }, myPriv, 256);
  return await kdf(bits);
}

/**
 * Ключ сессии для личного чата (DM) с привязкой к chatId.
 * Один и тот же собеседник в разных чатах даёт разные ключи.
 */
export async function deriveSessionKeyForChat(otherPubJwk: any, chatId: string): Promise<CryptoKey> {
  const myPriv = await getMyPrivateKey();
  const otherPub = await importPublicKeyJwk(otherPubJwk);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: otherPub }, myPriv, 256);
  return deriveKeyHKDF(bits, HKDF_INFO_DM + chatId);
}
function bufToB64(buf: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64ToBuf(b64: string) { return Uint8Array.from(atob(b64), c=>c.charCodeAt(0)); }

export async function encryptPlaintext(aesKey: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, strToBuf(plaintext));
  return JSON.stringify({ iv: bufToB64(iv), ct: bufToB64(ct) });
}
export async function decryptCiphertext(aesKey: CryptoKey, ciphertext: string) {
  const obj = JSON.parse(ciphertext);
  const iv = b64ToBuf(obj.iv);
  const ct = b64ToBuf(obj.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(pt);
}

// Group E2EE: groupKey (AES raw) wrapped for each user via ECDH
export async function generateGroupKey() {
  return await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt','decrypt']);
}
export async function exportRawKey(key: CryptoKey) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}
export async function importRawKey(b64: string) {
  const raw = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
  return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}
/**
 * Обёртка группового ключа для участника. При указании chatId используется HKDF (SafeGram Shield).
 */
export async function wrapKeyForUser(groupKey: CryptoKey, userPubJwk: any, chatId?: string) {
  const myPriv = await getMyPrivateKey();
  const otherPub = await importPublicKeyJwk(userPubJwk);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: otherPub }, myPriv, 256);
  const shared = chatId
    ? await deriveKeyHKDF(bits, HKDF_INFO_GROUP_WRAP + chatId)
    : await kdf(bits);
  const rawB64 = await exportRawKey(groupKey);
  return await encryptPlaintext(shared, rawB64);
}
export async function unwrapKeyFromEnvelope(encrypted: string, senderPubJwk: any, chatId?: string) {
  const myPriv = await getMyPrivateKey();
  const otherPub = await importPublicKeyJwk(senderPubJwk);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: otherPub }, myPriv, 256);
  const shared = chatId
    ? await deriveKeyHKDF(bits, HKDF_INFO_GROUP_WRAP + chatId)
    : await kdf(bits);
  const rawB64 = await decryptCiphertext(shared, encrypted);
  return await importRawKey(rawB64);
}

// Проверка отпечатков ключей (fingerprint verification)
export async function getKeyFingerprint(publicKeyJwk: JsonWebKey): Promise<string> {
  // Вычисляем SHA-256 от публичного ключа
  const keyJson = JSON.stringify(publicKeyJwk, Object.keys(publicKeyJwk).sort());
  const hash = await crypto.subtle.digest('SHA-256', strToBuf(keyJson));
  const hashArray = Array.from(new Uint8Array(hash));
  // Возвращаем первые 16 байт в hex формате (32 символа)
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function getMyKeyFingerprint(): Promise<string> {
  const myPubKey = await getMyPublicJwk();
  return await getKeyFingerprint(myPubKey);
}
