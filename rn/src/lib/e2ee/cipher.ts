/**
 * E2EE: шифрование/расшифрование сообщений AES-GCM.
 * Ключ — результат deriveSharedSecret (сессионный ключ с собеседником).
 */

import type { CipherPayload } from './types';

export async function encrypt(
  _plaintext: string,
  _key: ArrayBuffer
): Promise<CipherPayload> {
  // TODO: AES-GCM encrypt with random IV, export iv + ciphertext + tag
  return {
    iv: '',
    ciphertext: '',
    tag: '',
  };
}

export async function decrypt(
  _payload: CipherPayload,
  _key: ArrayBuffer
): Promise<string> {
  // TODO: AES-GCM decrypt
  return '';
}
