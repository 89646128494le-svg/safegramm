
// E2EE helpers (same as before, TS)
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function importPublicKeyJwk(jwk: JsonWebKey) {
  return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}
async function importPrivateKeyPkcs8(pkcs8: string) {
  const raw = Uint8Array.from(atob(pkcs8), c=>c.charCodeAt(0));
  return await crypto.subtle.importKey('pkcs8', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}
async function exportPublicJwk(key: CryptoKey) { return await crypto.subtle.exportKey('jwk', key); }
async function exportPrivatePkcs8(key: CryptoKey) { const buf = await crypto.subtle.exportKey('pkcs8', key); return btoa(String.fromCharCode(...new Uint8Array(buf))); }
async function kdf(sharedBits: ArrayBuffer) { const hash = await crypto.subtle.digest('SHA-256', sharedBits); return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt','decrypt']); }

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
    await fetch(API + '/api/users/public_key', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ publicKeyJwk: pubJwk }) });
  } else {
    const token = localStorage.getItem('token');
    await fetch(API + '/api/users/public_key', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ publicKeyJwk: JSON.parse(pub) }) });
  }
}

export async function getMyPublicJwk() { return JSON.parse(localStorage.getItem('sg_pub')!); }
export async function getMyPrivateKey() { return await importPrivateKeyPkcs8(localStorage.getItem('sg_priv')!); }

export async function deriveSharedKey(otherPubJwk: any) {
  const myPriv = await getMyPrivateKey();
  const otherPub = await importPublicKeyJwk(otherPubJwk);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: otherPub }, myPriv, 256);
  return await kdf(bits);
}

function strToBuf(s: string) { return new TextEncoder().encode(s); }
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
export async function wrapKeyForUser(groupKey: CryptoKey, userPubJwk: any) {
  // derive a shared AES from my private key and user's pub, encrypt raw groupKey with it
  const shared = await deriveSharedKey(userPubJwk);
  // export group key raw and encrypt as plaintext
  const rawB64 = await exportRawKey(groupKey);
  return await encryptPlaintext(shared, rawB64);
}
export async function unwrapKeyFromEnvelope(encrypted: string, senderPubJwk: any) {
  const shared = await deriveSharedKey(senderPubJwk);
  const rawB64 = await decryptCiphertext(shared, encrypted);
  return await importRawKey(rawB64);
}
