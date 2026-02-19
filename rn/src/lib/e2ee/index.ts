/**
 * SafeGram E2EE — единая точка входа для мобильного клиента.
 * Использование: generateKeyPair → отправить publicKey на сервер;
 * для чата: deriveSharedSecret(myRef, otherPub) → encrypt/decrypt.
 */

export * from './types';
export * from './keys';
export * from './cipher';
