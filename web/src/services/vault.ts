import { getApiBaseUrl } from './api';

const VAULT_MASTER_KEY_STORAGE = 'safegram_vault_master_key_v1';
const VAULT_RECORDS_STORAGE = 'safegram_vault_records_v1';

export type VaultEnvelope = {
  v: 'sg-vault-1';
  alg: 'AES-256-GCM';
  iv: string;
  name: string;
  type: string;
  size: number;
};

export type VaultRecord = {
  id: string;
  chatId: string;
  attachmentUrl: string;
  createdAt: number;
  envelope: VaultEnvelope;
};

function bytesToB64(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function b64ToBytes(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getOrCreateVaultMasterKey(): Promise<CryptoKey> {
  let rawB64 = localStorage.getItem(VAULT_MASTER_KEY_STORAGE);
  if (!rawB64) {
    const random = crypto.getRandomValues(new Uint8Array(32));
    rawB64 = bytesToB64(random);
    localStorage.setItem(VAULT_MASTER_KEY_STORAGE, rawB64);
  }
  return crypto.subtle.importKey('raw', b64ToBytes(rawB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptFileForVault(file: File): Promise<{ encryptedFile: File; envelope: VaultEnvelope }> {
  const key = await getOrCreateVaultMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = await file.arrayBuffer();
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);

  const encryptedFile = new File([cipher], `${file.name}.sgvault`, {
    type: 'application/octet-stream',
    lastModified: Date.now(),
  });
  const envelope: VaultEnvelope = {
    v: 'sg-vault-1',
    alg: 'AES-256-GCM',
    iv: bytesToB64(iv),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  };
  return { encryptedFile, envelope };
}

export async function decryptVaultBlob(encrypted: Blob, envelope: VaultEnvelope): Promise<Blob> {
  const key = await getOrCreateVaultMasterKey();
  const iv = b64ToBytes(envelope.iv);
  const cipher = await encrypted.arrayBuffer();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new Blob([plain], { type: envelope.type || 'application/octet-stream' });
}

export function listVaultRecords(): VaultRecord[] {
  const raw = localStorage.getItem(VAULT_RECORDS_STORAGE);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveVaultRecord(record: VaultRecord): void {
  const records = listVaultRecords();
  records.unshift(record);
  localStorage.setItem(VAULT_RECORDS_STORAGE, JSON.stringify(records.slice(0, 500)));
}

export function removeVaultRecord(id: string): void {
  const records = listVaultRecords().filter((item) => item.id !== id);
  localStorage.setItem(VAULT_RECORDS_STORAGE, JSON.stringify(records));
}

export async function downloadAndDecryptVaultRecord(record: VaultRecord): Promise<void> {
  const token = localStorage.getItem('token');
  const attachmentUrl = record.attachmentUrl.startsWith('http')
    ? record.attachmentUrl
    : `${getApiBaseUrl()}${record.attachmentUrl.startsWith('/') ? '' : '/'}${record.attachmentUrl}`;

  const response = await fetch(attachmentUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error('vault_download_failed');

  const encryptedBlob = await response.blob();
  const decryptedBlob = await decryptVaultBlob(encryptedBlob, record.envelope);
  const url = URL.createObjectURL(decryptedBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = record.envelope.name || 'vault-file.bin';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

