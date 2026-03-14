export const LEGACY_HOSTNAME = 'safegram-hazel.vercel.app';
export const TARGET_HOSTNAME = 'safegram.site';
export const TARGET_URL = 'https://safegram.site';
export const MIGRATION_DEADLINE_ISO = '2026-03-14T23:25:00+03:00';
export const MIGRATION_WARNING_WINDOW_MS = 60 * 60 * 1000;

export type DomainMigrationPhase = 'inactive' | 'countdown' | 'completed';

export interface DomainMigrationState {
  enabled: boolean;
  legacyHost: boolean;
  phase: DomainMigrationPhase;
  nowMs: number;
  deadlineMs: number;
  warningStartsAtMs: number;
  msUntilDeadline: number;
  shouldShowCountdown: boolean;
  shouldShowCompletion: boolean;
  authClosed: boolean;
  targetUrl: string;
}

export function normalizeHostname(hostname?: string | null): string {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

export function isLegacyHost(hostname?: string | null): boolean {
  return normalizeHostname(hostname) === LEGACY_HOSTNAME;
}

export function getDomainMigrationState(nowMs = Date.now(), hostname?: string | null): DomainMigrationState {
  const deadlineMs = new Date(MIGRATION_DEADLINE_ISO).getTime();
  const warningStartsAtMs = deadlineMs - MIGRATION_WARNING_WINDOW_MS;
  const legacyHost = isLegacyHost(hostname);

  if (!legacyHost) {
    return {
      enabled: false,
      legacyHost: false,
      phase: 'inactive',
      nowMs,
      deadlineMs,
      warningStartsAtMs,
      msUntilDeadline: Math.max(0, deadlineMs - nowMs),
      shouldShowCountdown: false,
      shouldShowCompletion: false,
      authClosed: false,
      targetUrl: TARGET_URL,
    };
  }

  let phase: DomainMigrationPhase = 'inactive';
  if (nowMs >= deadlineMs) phase = 'completed';
  else if (nowMs >= warningStartsAtMs) phase = 'countdown';

  return {
    enabled: phase !== 'inactive',
    legacyHost,
    phase,
    nowMs,
    deadlineMs,
    warningStartsAtMs,
    msUntilDeadline: Math.max(0, deadlineMs - nowMs),
    shouldShowCountdown: phase === 'countdown',
    shouldShowCompletion: phase === 'completed',
    authClosed: phase === 'countdown' || phase === 'completed',
    targetUrl: TARGET_URL,
  };
}

export function formatCountdownParts(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

export function getMigrationDeadlineLabel() {
  return new Date(MIGRATION_DEADLINE_ISO).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
