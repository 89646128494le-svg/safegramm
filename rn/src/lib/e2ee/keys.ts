/**
 * E2EE: генерация и хранение ключей.
 * В продакшене: использовать expo-secure-store или react-native-keychain
 * для хранения privateKeyRef. Публичный ключ отправляется на сервер.
 */

import type { KeyPair } from './types';

const STUB_PUB = 'safegram-e2ee-stub-public';
const STUB_REF = 'safegram-e2ee-stub-private-ref';

export async function generateKeyPair(): Promise<KeyPair> {
  // TODO: react-native-quick-crypto или native module для ECDH P-256
  // Сейчас — заглушка для структуры проекта
  return {
    publicKey: STUB_PUB,
    privateKeyRef: STUB_REF,
  };
}

export async function getPublicKey(): Promise<string | null> {
  return STUB_PUB;
}

export async function deriveSharedSecret(
  _myPrivateRef: string,
  _otherPublicKey: string
): Promise<ArrayBuffer> {
  // TODO: ECDH derive + HKDF
  return new ArrayBuffer(32);
}
