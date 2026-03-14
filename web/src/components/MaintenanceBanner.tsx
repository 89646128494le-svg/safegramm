import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  FlaskConical,
  Info,
  Rocket,
  Wrench,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useDomainMigration } from '../contexts/DomainMigrationContext';
import { formatCountdownParts, getMigrationDeadlineLabel } from '../lib/domainMigration';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import type { MaintenanceStatus } from '../store/useStore';

const POLL_INTERVAL_MS = 20_000;
const PENDING_BETA_NOTICE_KEY = 'safegram_beta_notice_pending';
const DISMISSED_BETA_NOTICE_KEY = 'safegram_beta_notice_dismissed';
const DISMISSED_SYSTEM_BANNER_PREFIX = 'safegram_system_banner_dismissed_';
const SYSTEM_BANNER_EVENT = 'system-banner-updated';
const COMPLETION_REDIRECT_DELAY_MS = 6500;
const COMPLETION_SHOWN_KEY = 'safegram_domain_migration_complete_seen';

type SystemBannerSeverity = 'info' | 'success' | 'warning' | 'critical';

interface SystemBannerStatus {
  enabled?: boolean;
  isActive?: boolean;
  id?: string;
  title?: string;
  message?: string;
  severity?: SystemBannerSeverity;
  dismissible?: boolean;
  startsAt?: string;
  endsAt?: string;
}

type BannerNotice =
  | {
      kind: 'migration';
      id: 'domain-migration';
      title: string;
      message: string;
      timestamp?: string;
    }
  | {
      kind: 'maintenance';
      id: string;
      title: string;
      message: string;
      timestamp?: string;
    }
  | {
      kind: 'system';
      id: string;
      title: string;
      message: string;
      timestamp?: string;
      severity: SystemBannerSeverity;
      dismissible: boolean;
    }
  | {
      kind: 'beta';
      id: 'beta';
      title: string;
      message: string;
      timestamp?: string;
    };

const BETA_TITLE = 'SafeGram сейчас работает в тестовом режиме';
const BETA_MESSAGE =
  'Сейчас идёт открытая beta-стадия: возможны быстрые изменения, временные ограничения и мелкие сбои. Если заметите ошибку, баг или странное поведение, незамедлительно пишите в Техподдержку.';
const MAINTENANCE_TITLE = 'Сейчас идут технические работы';
const MAINTENANCE_FALLBACK_MESSAGE =
  'Часть функций может работать медленнее или быть временно недоступна.';
const MIGRATION_TITLE = 'SafeGram переезжает на safegram.site';
const MIGRATION_MESSAGE =
  'До переключения остался последний час. На этом адресе новые входы и регистрации уже закрыты, чтобы переезд прошёл спокойно и без потерь.';
const SUPPORT_BUTTON_LABEL = 'Написать в Техподдержку';
const CLOSE_LABEL = 'Закрыть уведомление';
const TECHWORKS_BADGE = 'Техработы';
const MIGRATION_BADGE = 'Переезд';
const SYSTEM_BADGE_LABELS: Record<SystemBannerSeverity, string> = {
  info: 'Инфо',
  success: 'Обновление',
  warning: 'Важно',
  critical: 'Критично',
};

function readPendingBetaNotice(): BannerNotice | null {
  if (typeof window === 'undefined') return null;
  if (sessionStorage.getItem(PENDING_BETA_NOTICE_KEY) !== '1') return null;
  if (localStorage.getItem(DISMISSED_BETA_NOTICE_KEY) === '1') return null;

  return {
    kind: 'beta',
    id: 'beta',
    title: BETA_TITLE,
    message: BETA_MESSAGE,
  };
}

export default function MaintenanceBanner() {
  const location = useLocation();
  const { setMaintenance } = useStore();
  const domainMigration = useDomainMigration();
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceStatus | null>(null);
  const [systemBannerData, setSystemBannerData] = useState<SystemBannerStatus | null>(null);
  const [betaDismissed, setBetaDismissed] = useState(false);
  const countdown = useMemo(
    () => formatCountdownParts(domainMigration.msUntilDeadline),
    [domainMigration.msUntilDeadline],
  );

  const syncDismissState = useCallback(() => {
    if (typeof window === 'undefined') return;
    setBetaDismissed(localStorage.getItem(DISMISSED_BETA_NOTICE_KEY) === '1');
  }, []);

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      const [maintenanceResponse, bannerResponse] = await Promise.all([
        api('/api/maintenance/status', 'GET'),
        api('/api/system-banner/status', 'GET').catch(() => null),
      ]);
      const data = maintenanceResponse?.isActive
        ? {
            isActive: true,
            message: maintenanceResponse.message || '',
            timestamp: maintenanceResponse.timestamp || '',
            id: maintenanceResponse.id || '',
          }
        : null;

      setMaintenance(data);
      setMaintenanceData(data);
      setSystemBannerData(bannerResponse?.isActive ? bannerResponse : null);
    } catch {
      setMaintenance(null);
      setMaintenanceData(null);
      setSystemBannerData(null);
    }
  }, [setMaintenance]);

  useEffect(() => {
    syncDismissState();
    checkMaintenanceStatus();

    const interval = window.setInterval(checkMaintenanceStatus, POLL_INTERVAL_MS);
    const onUpdated = () => {
      syncDismissState();
      checkMaintenanceStatus();
    };

    window.addEventListener('maintenance-updated', onUpdated);
    window.addEventListener(SYSTEM_BANNER_EVENT, onUpdated);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('maintenance-updated', onUpdated);
      window.removeEventListener(SYSTEM_BANNER_EVENT, onUpdated);
    };
  }, [checkMaintenanceStatus, syncDismissState]);

  useEffect(() => {
    syncDismissState();
  }, [location.key, syncDismissState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !domainMigration.shouldShowCompletion) return;

    const alreadyShown = sessionStorage.getItem(COMPLETION_SHOWN_KEY) === '1';
    if (!alreadyShown) {
      sessionStorage.setItem(COMPLETION_SHOWN_KEY, '1');
    }

    const delay = alreadyShown ? 400 : COMPLETION_REDIRECT_DELAY_MS;
    const timer = window.setTimeout(() => {
      window.location.replace(domainMigration.targetUrl);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [domainMigration.shouldShowCompletion, domainMigration.targetUrl]);

  const activeNotice = useMemo<BannerNotice | null>(() => {
    if (domainMigration.shouldShowCountdown) {
      return {
        kind: 'migration',
        id: 'domain-migration',
        title: MIGRATION_TITLE,
        message: MIGRATION_MESSAGE,
        timestamp: `Переключение: ${getMigrationDeadlineLabel()}`,
      };
    }

    if (maintenanceData?.isActive && maintenanceData.id) {
      return {
        kind: 'maintenance',
        id: maintenanceData.id,
        title: MAINTENANCE_TITLE,
        message: maintenanceData.message || MAINTENANCE_FALLBACK_MESSAGE,
        timestamp: maintenanceData.timestamp,
      };
    }

    if (systemBannerData?.isActive && systemBannerData.id) {
      if (systemBannerData.dismissible && typeof window !== 'undefined') {
        const dismissed =
          localStorage.getItem(DISMISSED_SYSTEM_BANNER_PREFIX + systemBannerData.id) === '1';
        if (dismissed) return null;
      }

      const scheduleLabel = systemBannerData.endsAt
        ? `до ${new Date(systemBannerData.endsAt).toLocaleString('ru-RU')}`
        : systemBannerData.startsAt
          ? `с ${new Date(systemBannerData.startsAt).toLocaleString('ru-RU')}`
          : undefined;

      return {
        kind: 'system',
        id: systemBannerData.id,
        title: systemBannerData.title || 'Важное сообщение',
        message: systemBannerData.message || '',
        timestamp: scheduleLabel,
        severity: systemBannerData.severity || 'info',
        dismissible: Boolean(systemBannerData.dismissible),
      };
    }

    if (!maintenanceData?.isActive && !betaDismissed) {
      return readPendingBetaNotice();
    }

    return null;
  }, [betaDismissed, domainMigration.shouldShowCountdown, maintenanceData, systemBannerData]);

  const palette = useMemo(() => {
    if (activeNotice?.kind === 'migration') {
      return {
        background:
          'linear-gradient(135deg, rgba(21, 30, 62, 0.97) 0%, rgba(18, 58, 104, 0.97) 42%, rgba(34, 125, 222, 0.97) 100%)',
        foreground: '#f8fbff',
        badgeBackground: 'rgba(255,255,255,0.12)',
        border: 'rgba(255,255,255,0.16)',
        icon: <Rocket size={22} strokeWidth={2.2} />,
        shadow: '0 18px 40px rgba(42, 118, 223, 0.26)',
      };
    }

    if (activeNotice?.kind === 'maintenance') {
      return {
        background:
          'linear-gradient(135deg, rgba(255, 193, 7, 0.96) 0%, rgba(255, 138, 0, 0.96) 100%)',
        foreground: '#0f172a',
        badgeBackground: 'rgba(15, 23, 42, 0.12)',
        border: 'rgba(255,255,255,0.24)',
        icon: <Wrench size={22} strokeWidth={2.4} />,
        shadow: '0 14px 36px rgba(255, 138, 0, 0.28)',
      };
    }

    if (activeNotice?.kind === 'system') {
      const severity = activeNotice.severity;
      if (severity === 'critical') {
        return {
          background:
            'linear-gradient(135deg, rgba(185, 28, 28, 0.96) 0%, rgba(244, 63, 94, 0.96) 100%)',
          foreground: '#fff5f5',
          badgeBackground: 'rgba(255,255,255,0.12)',
          border: 'rgba(255,255,255,0.18)',
          icon: <AlertTriangle size={22} strokeWidth={2.4} />,
          shadow: '0 14px 36px rgba(244, 63, 94, 0.24)',
        };
      }
      if (severity === 'warning') {
        return {
          background:
            'linear-gradient(135deg, rgba(245, 158, 11, 0.96) 0%, rgba(251, 191, 36, 0.96) 100%)',
          foreground: '#111827',
          badgeBackground: 'rgba(15,23,42,0.10)',
          border: 'rgba(255,255,255,0.22)',
          icon: <AlertTriangle size={22} strokeWidth={2.4} />,
          shadow: '0 14px 36px rgba(245, 158, 11, 0.22)',
        };
      }
      if (severity === 'success') {
        return {
          background:
            'linear-gradient(135deg, rgba(5, 150, 105, 0.96) 0%, rgba(16, 185, 129, 0.96) 100%)',
          foreground: '#ecfdf5',
          badgeBackground: 'rgba(255,255,255,0.14)',
          border: 'rgba(255,255,255,0.18)',
          icon: <Info size={22} strokeWidth={2.2} />,
          shadow: '0 14px 36px rgba(16, 185, 129, 0.24)',
        };
      }
      return {
        background:
          'linear-gradient(135deg, rgba(37, 99, 235, 0.96) 0%, rgba(14, 165, 233, 0.96) 100%)',
        foreground: '#eff6ff',
        badgeBackground: 'rgba(255,255,255,0.16)',
        border: 'rgba(255,255,255,0.18)',
        icon: <Info size={22} strokeWidth={2.2} />,
        shadow: '0 14px 36px rgba(14, 165, 233, 0.24)',
      };
    }

    return {
      background:
        'linear-gradient(135deg, rgba(37, 99, 235, 0.96) 0%, rgba(14, 165, 233, 0.96) 100%)',
      foreground: '#eff6ff',
      badgeBackground: 'rgba(255,255,255,0.16)',
      border: 'rgba(255,255,255,0.18)',
      icon: <FlaskConical size={22} strokeWidth={2.2} />,
      shadow: '0 14px 36px rgba(14, 165, 233, 0.24)',
    };
  }, [activeNotice]);

  const dismissNotice = useCallback(() => {
    if (typeof window === 'undefined' || !activeNotice) return;
    if (activeNotice.kind === 'maintenance' || activeNotice.kind === 'migration') return;

    if (activeNotice.kind === 'system') {
      if (!activeNotice.dismissible) return;
      localStorage.setItem(DISMISSED_SYSTEM_BANNER_PREFIX + activeNotice.id, '1');
      setSystemBannerData((prev) => (prev?.id === activeNotice.id ? null : prev));
      return;
    }

    localStorage.setItem(DISMISSED_BETA_NOTICE_KEY, '1');
    sessionStorage.removeItem(PENDING_BETA_NOTICE_KEY);
    setBetaDismissed(true);
  }, [activeNotice]);

  const openSupport = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.location.assign('/support');
  }, []);

  if (!activeNotice && !domainMigration.shouldShowCompletion) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {activeNotice && (
          <motion.div
            key={activeNotice.kind + activeNotice.id}
            initial={{ y: -96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9998,
              background: palette.background,
              boxShadow: palette.shadow,
              borderBottom: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                maxWidth: 1280,
                margin: '0 auto',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                color: palette.foreground,
              }}
            >
              <motion.div
                animate={
                  activeNotice.kind === 'maintenance'
                    ? { rotate: [0, -5, 5, 0] }
                    : activeNotice.kind === 'migration'
                      ? { y: [0, -3, 0], scale: [1, 1.03, 1] }
                      : { scale: [1, 1.08, 1] }
                }
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  flexShrink: 0,
                  width: 42,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  background: palette.badgeBackground,
                  border: `1px solid ${palette.border}`,
                }}
              >
                {palette.icon}
              </motion.div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 6,
                  }}
                >
                  <strong style={{ fontSize: 16, lineHeight: 1.2 }}>{activeNotice.title}</strong>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                      background: palette.badgeBackground,
                      border: `1px solid ${palette.border}`,
                    }}
                  >
                    {activeNotice.kind === 'maintenance' ? <AlertTriangle size={14} /> : <Info size={14} />}
                    {activeNotice.kind === 'maintenance'
                      ? TECHWORKS_BADGE
                      : activeNotice.kind === 'migration'
                        ? MIGRATION_BADGE
                        : activeNotice.kind === 'system'
                          ? SYSTEM_BADGE_LABELS[activeNotice.severity]
                          : 'Beta'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    flexWrap: 'wrap',
                    fontSize: 14,
                    lineHeight: 1.45,
                    opacity: 0.98,
                  }}
                >
                  <span style={{ minWidth: 260, flex: 1 }}>{activeNotice.message}</span>
                  {activeNotice.timestamp && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                      }}
                    >
                      <Clock3 size={15} />
                      {activeNotice.timestamp}
                    </span>
                  )}
                  {activeNotice.kind === 'migration' && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {[
                        { label: 'Ч', value: countdown.hours },
                        { label: 'М', value: countdown.minutes },
                        { label: 'С', value: countdown.seconds },
                      ].map((item) => (
                        <div
                          key={item.label}
                          style={{
                            minWidth: 54,
                            padding: '8px 10px',
                            borderRadius: 12,
                            background: 'rgba(5, 10, 25, 0.2)',
                            border: `1px solid ${palette.border}`,
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{item.value}</div>
                          <div style={{ marginTop: 4, fontSize: 10, opacity: 0.8, letterSpacing: '0.08em' }}>{item.label}</div>
                        </div>
                      ))}
                      <a
                        href={domainMigration.targetUrl}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '9px 14px',
                          borderRadius: 12,
                          border: `1px solid ${palette.border}`,
                          background: 'rgba(255,255,255,0.18)',
                          color: palette.foreground,
                          textDecoration: 'none',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Перейти на safegram.site
                        <ArrowRight size={15} />
                      </a>
                    </div>
                  )}
                  {activeNotice.kind === 'beta' && (
                    <button
                      type="button"
                      onClick={openSupport}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 14px',
                        borderRadius: 12,
                        border: `1px solid ${palette.border}`,
                        background: 'rgba(255,255,255,0.18)',
                        color: palette.foreground,
                        cursor: 'pointer',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Info size={15} />
                      {SUPPORT_BUTTON_LABEL}
                    </button>
                  )}
                </div>
              </div>

              {(activeNotice.kind === 'beta' ||
                (activeNotice.kind === 'system' && activeNotice.dismissible)) && (
                <button
                  type="button"
                  onClick={dismissNotice}
                  aria-label={CLOSE_LABEL}
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    border: `1px solid ${palette.border}`,
                    background: palette.badgeBackground,
                    color: palette.foreground,
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {domainMigration.shouldShowCompletion && (
          <motion.div
            key="domain-migration-complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background:
                'radial-gradient(circle at 20% 20%, rgba(61, 216, 255, 0.14), transparent 26%), radial-gradient(circle at 80% 18%, rgba(124, 108, 255, 0.18), transparent 28%), linear-gradient(180deg, rgba(4, 8, 18, 0.98) 0%, rgba(7, 12, 24, 0.99) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 20px',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 26, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45 }}
              style={{
                width: 'min(100%, 820px)',
                padding: '40px 32px',
                borderRadius: 32,
                background: 'rgba(9, 15, 28, 0.82)',
                border: '1px solid rgba(131, 150, 191, 0.14)',
                boxShadow: '0 30px 90px rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(22px)',
                color: '#eef4ff',
                textAlign: 'center',
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 18 }}
                style={{
                  width: 92,
                  height: 92,
                  margin: '0 auto 22px',
                  borderRadius: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(124,108,255,0.24), rgba(61,216,255,0.22))',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 0 60px rgba(61, 216, 255, 0.18)',
                }}
              >
                <Rocket size={42} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                style={{ margin: '0 0 14px', fontSize: 'clamp(34px, 6vw, 64px)', lineHeight: 0.95, fontWeight: 900 }}
              >
                SafeGram переезжает на safegram.site
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  margin: '0 auto 20px',
                  maxWidth: 640,
                  fontSize: 18,
                  lineHeight: 1.7,
                  color: 'rgba(225, 234, 255, 0.8)',
                }}
              >
                Спасибо, что были с нами на beta-домене. Сейчас перенаправим вас на новый адрес, где продолжится работа мессенджера.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 18px',
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontWeight: 700,
                }}
              >
                <span>Переходим на safegram.site</span>
                <motion.div
                  animate={{ x: [0, 6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArrowRight size={18} />
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
