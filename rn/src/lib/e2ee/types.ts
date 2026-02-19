/**
 * SafeGram E2EE — типы для мобильного клиента.
 * Протокол: ECDH P-256 + HKDF + AES-GCM (как в web/desktop).
 * Закрытый ключ хранится в защищённом хранилище (Keychain/Keystore).
 */

export interface KeyPair {
  publicKey: string;
  privateKeyRef: string;
}

export interface CipherPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface E2EEConfig {
  curve: 'P-256';
  kdf: 'HKDF-SHA256';
  cipher: 'AES-GCM';
}
