/**
 * Bridge: фронтенд → бинарный протокол Go-ядра.
 * Handshake: ECDH (X25519), сессионный ключ только в памяти.
 * Формат пакета: Len(4) || Type(2) || SessionID(8) || Payload(encrypted) || Checksum(32). LittleEndian.
 */

const KEY_SIZE = 32;
const SESSION_ID_SIZE = 8;
const LEN_SIZE = 4;
const TYPE_SIZE = 2;
const CHECKSUM_SIZE = 32;
const GCM_NONCE_SIZE = 12;
const GCM_TAG_SIZE = 16;
const KDF_INFO = new TextEncoder().encode('safegram-session-v1');

export const TypeText = 0x01;
export const TypeTyping = 0x03;
export const TypeReadReceipt = 0x04;

async function sha256(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', data);
}

async function deriveAESKey(sharedSecret: ArrayBuffer): Promise<ArrayBuffer> {
  const info = KDF_INFO;
  const total = new Uint8Array(sharedSecret.byteLength + info.byteLength);
  total.set(new Uint8Array(sharedSecret), 0);
  total.set(info, sharedSecret.byteLength);
  const hash = await sha256(total);
  return hash.slice(0, KEY_SIZE);
}

export async function generateKeyPair(): Promise<{ publicKey: ArrayBuffer; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'X25519' },
    true,
    ['deriveBits']
  );
  const publicKey = await crypto.subtle.exportKey('raw', pair.publicKey);
  return { publicKey, privateKey: pair.privateKey };
}

export async function deriveSessionKey(
  privateKey: CryptoKey,
  serverPublicKeyRaw: ArrayBuffer
): Promise<ArrayBuffer> {
  const serverPub = await crypto.subtle.importKey(
    'raw',
    serverPublicKeyRaw,
    { name: 'ECDH', namedCurve: 'X25519' },
    false,
    []
  );
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPub },
    privateKey,
    256
  );
  return deriveAESKey(shared);
}

export async function encryptGCM(
  key: ArrayBuffer,
  plaintext: string | Uint8Array
): Promise<Uint8Array> {
  const pt = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;
  const keyC = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(GCM_NONCE_SIZE));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    keyC,
    pt
  );
  const out = new Uint8Array(nonce.length + ciphertext.byteLength);
  out.set(nonce, 0);
  out.set(new Uint8Array(ciphertext), nonce.length);
  return out;
}

export async function decryptGCM(key: ArrayBuffer, ciphertext: Uint8Array): Promise<Uint8Array> {
  if (ciphertext.length < GCM_NONCE_SIZE + GCM_TAG_SIZE) throw new Error('ciphertext too short');
  const keyC = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
  const nonce = ciphertext.slice(0, GCM_NONCE_SIZE);
  const ct = ciphertext.slice(GCM_NONCE_SIZE);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    keyC,
    ct
  );
  return new Uint8Array(plain);
}

function packPacket(
  typeId: number,
  sessionId: bigint,
  payloadEnc: Uint8Array
): Uint8Array {
  const bodyLen = TYPE_SIZE + SESSION_ID_SIZE + payloadEnc.length + CHECKSUM_SIZE;
  const checksum = new Uint8Array(await sha256(payloadEnc));
  const buf = new ArrayBuffer(LEN_SIZE + bodyLen);
  const view = new DataView(buf);
  view.setUint32(0, bodyLen, true);
  view.setUint16(LEN_SIZE, typeId, true);
  view.setBigUint64(LEN_SIZE + TYPE_SIZE, sessionId, true);
  const u8 = new Uint8Array(buf);
  u8.set(payloadEnc, LEN_SIZE + TYPE_SIZE + SESSION_ID_SIZE);
  u8.set(checksum, LEN_SIZE + TYPE_SIZE + SESSION_ID_SIZE + payloadEnc.length);
  return u8;
}

export async function packSendMessage(
  sessionId: bigint,
  sessionKey: ArrayBuffer,
  text: string,
  typeId: number = TypeText
): Promise<Uint8Array> {
  const payloadEnc = await encryptGCM(sessionKey, text);
  return packPacket(typeId, sessionId, payloadEnc);
}

export async function unpackReceiveMessage(
  frame: Uint8Array,
  sessionKey: ArrayBuffer
): Promise<{ typeId: number; sessionId: bigint; plaintext: string }> {
  if (frame.length < LEN_SIZE) throw new Error('frame too short');
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const bodyLen = view.getUint32(0, true);
  if (frame.length < LEN_SIZE + bodyLen) throw new Error('incomplete frame');
  const typeId = view.getUint16(LEN_SIZE, true);
  const sessionId = view.getBigUint64(LEN_SIZE + TYPE_SIZE, true);
  const payloadEnc = frame.slice(
    LEN_SIZE + TYPE_SIZE + SESSION_ID_SIZE,
    LEN_SIZE + bodyLen - CHECKSUM_SIZE
  );
  const checksumGot = frame.slice(LEN_SIZE + bodyLen - CHECKSUM_SIZE, LEN_SIZE + bodyLen);
  const checksumExpected = new Uint8Array(await sha256(payloadEnc));
  if (checksumGot.length !== checksumExpected.length || checksumGot.some((b, i) => b !== checksumExpected[i]))
    throw new Error('checksum mismatch');
  const plain = await decryptGCM(sessionKey, payloadEnc);
  const plaintext = new TextDecoder().decode(plain);
  return { typeId, sessionId, plaintext };
}

export interface CoreBridgeState {
  sessionId: bigint;
  sessionKey: ArrayBuffer;
  privateKey: CryptoKey;
}

export async function handshake(ws: WebSocket, token: string): Promise<CoreBridgeState> {
  const { publicKey: clientPub, privateKey } = await generateKeyPair();
  const clientPubArr = new Uint8Array(clientPub);
  if (clientPubArr.length !== KEY_SIZE) throw new Error('unexpected client pub length');

  ws.binaryType = 'arraybuffer';
  const serverPub = await new Promise<ArrayBuffer>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer && e.data.byteLength === KEY_SIZE) {
        ws.removeEventListener('message', onMsg);
        resolve(e.data);
      }
    };
    ws.addEventListener('message', onMsg);
    const t = setTimeout(() => {
      ws.removeEventListener('message', onMsg);
      reject(new Error('handshake timeout: server pub'));
    }, 5000);
    (ws as unknown as { _handshakeTimer?: number })._handshakeTimer = t as unknown as number;
  }).finally(() => {
    const t = (ws as unknown as { _handshakeTimer?: number })._handshakeTimer;
    if (t) clearTimeout(t);
  });

  ws.send(clientPub);

  const sessionKey = await deriveSessionKey(privateKey, serverPub);
  const sessionIdBuf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer && e.data.byteLength === SESSION_ID_SIZE) {
        ws.removeEventListener('message', onMsg);
        resolve(e.data);
      }
    };
    ws.addEventListener('message', onMsg);
    const t = setTimeout(() => {
      ws.removeEventListener('message', onMsg);
      reject(new Error('handshake timeout: sessionID'));
    }, 5000);
    (ws as unknown as { _handshakeTimer2?: number })._handshakeTimer2 = t as unknown as number;
  }).finally(() => {
    const t = (ws as unknown as { _handshakeTimer2?: number })._handshakeTimer2;
    if (t) clearTimeout(t);
  });
  const view = new DataView(sessionIdBuf);
  const sessionId = view.getBigUint64(0, true);

  return { sessionId, sessionKey, privateKey };
}
