import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

const MASTER_KEY_STORAGE_KEY = 'sg_lite_master_key_b64';
export const MOBILE_CIPHER_PREFIX = 'sg-lite-1:';

export type MobileCipherEnvelope = {
  v: 'sg-lite-1';
  n: string;
  c: string;
};

function asUint8Array(value: Uint8Array | number[]): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function randomBytes(len: number): Uint8Array {
  return asUint8Array(Crypto.getRandomBytes(len));
}

async function getOrCreateMasterKeyB64(): Promise<string> {
  const existing = await SecureStore.getItemAsync(MASTER_KEY_STORAGE_KEY);
  if (existing) return existing;
  const generated = encodeBase64(randomBytes(nacl.secretbox.keyLength));
  await SecureStore.setItemAsync(MASTER_KEY_STORAGE_KEY, generated);
  return generated;
}

async function deriveChatKey(chatId: string): Promise<Uint8Array> {
  const masterB64 = await getOrCreateMasterKeyB64();
  const digestB64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${masterB64}:${chatId}`,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  const key = decodeBase64(digestB64);
  if (key.length !== nacl.secretbox.keyLength) {
    throw new Error('invalid_derived_key');
  }
  return key;
}

export function isLiteCiphertext(ciphertext?: string | null): boolean {
  return Boolean(ciphertext && ciphertext.startsWith(MOBILE_CIPHER_PREFIX));
}

export async function encryptForChat(chatId: string, plaintext: string): Promise<string> {
  const key = await deriveChatKey(chatId);
  const nonce = randomBytes(nacl.secretbox.nonceLength);
  const msg = decodeUTF8(plaintext);
  const box = nacl.secretbox(msg, nonce, key);
  const envelope: MobileCipherEnvelope = {
    v: 'sg-lite-1',
    n: encodeBase64(nonce),
    c: encodeBase64(box),
  };
  const serialized = JSON.stringify(envelope);
  const payload = encodeBase64(decodeUTF8(serialized));
  return `${MOBILE_CIPHER_PREFIX}${payload}`;
}

export async function decryptForChat(chatId: string, ciphertext: string): Promise<string | null> {
  if (!isLiteCiphertext(ciphertext)) return null;
  try {
    const payload = ciphertext.slice(MOBILE_CIPHER_PREFIX.length);
    const decodedJson = encodeUTF8(decodeBase64(payload));
    const envelope = JSON.parse(decodedJson) as MobileCipherEnvelope;
    if (envelope.v !== 'sg-lite-1') return null;

    const key = await deriveChatKey(chatId);
    const nonce = decodeBase64(envelope.n);
    const box = decodeBase64(envelope.c);
    const opened = nacl.secretbox.open(box, nonce, key);
    if (!opened) return null;
    return encodeUTF8(opened);
  } catch {
    return null;
  }
}

