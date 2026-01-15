
/**
 * SafeGram Shield (MVP): ECDH P-256 + AES-GCM
 * - Каждый пользователь публикует публичный ключ (JWK) на сервере.
 * - Для DM берём свой pub, чужой pub, делаем deriveBits => KDF => AES-GCM.
 * - Сервер видит только шифротексты.
 * - Закрытый ключ хранится в localStorage (для MVP). Для реального продукта: зашифровать его PIN'ом/паролем и держать в защищённом контейнере.
 */

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function importPublicKeyJwk(jwk) {
  return await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );
}
async function importPrivateKeyPkcs8(pkcs8) {
  const raw = Uint8Array.from(atob(pkcs8), c=>c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
}
async function exportPublicJwk(key) {
  return await crypto.subtle.exportKey('jwk', key);
}
async function exportPrivatePkcs8(key) {
  const buf = await crypto.subtle.exportKey('pkcs8', key);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
async function kdf(sharedBits) {
  // В реальном протоколе делаем HKDF с salt/info; здесь упрощённо:
  const hash = await crypto.subtle.digest('SHA-256', sharedBits);
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
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
    // опубликуем публичный ключ
    const token = localStorage.getItem('token');
    await fetch(API + '/api/users/public_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ publicKeyJwk: pubJwk })
    });
  } else {
    // на всякий случай убеждаемся, что он опубликован
    const token = localStorage.getItem('token');
    await fetch(API + '/api/users/public_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ publicKeyJwk: JSON.parse(pub) })
    });
  }
}

export async function deriveSharedKey(myPubJwk, otherPubJwk) {
  // берём свой приватный из localStorage
  const privPkcs8 = localStorage.getItem('sg_priv');
  const myPriv = await importPrivateKeyPkcs8(privPkcs8);
  const otherPub = await importPublicKeyJwk(otherPubJwk);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: otherPub }, myPriv, 256);
  const aesKey = await kdf(bits);
  return aesKey;
}

function strToBuf(s) {
  return new TextEncoder().encode(s);
}
function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
}

export async function encryptPlaintext(aesKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, strToBuf(plaintext));
  return JSON.stringify({ iv: bufToB64(iv), ct: bufToB64(ct) });
}

export async function decryptCiphertext(aesKey, ciphertext) {
  const obj = JSON.parse(ciphertext);
  const iv = b64ToBuf(obj.iv);
  const ct = b64ToBuf(obj.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(pt);
}
