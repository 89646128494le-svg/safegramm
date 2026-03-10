import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Clock3, FlaskConical, Info, Wrench, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import type { MaintenanceStatus } from '../store/useStore';

const POLL_INTERVAL_MS = 20_000;
const DISMISSED_MAINTENANCE_KEY = 'dismissedMaintenanceId';
const PENDING_BETA_NOTICE_KEY = 'safegram_beta_notice_pending';
const DISMISSED_BETA_NOTICE_KEY = 'safegram_beta_notice_dismissed';
const SYSTEM_BANNER_EVENT = 'system-banner-updated';

type BannerNotice =
  | {
      kind: 'maintenance';
      id: string;
      title: string;
      message: string;
      timestamp?: string;
    }
  | {
      kind: 'beta';
      id: 'beta';
      title: string;
      message: string;
      timestamp?: string;
    };

const BETA_TITLE =
  'SafeGram \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0432 \u0442\u0435\u0441\u0442\u043e\u0432\u043e\u043c \u0440\u0435\u0436\u0438\u043c\u0435';
const BETA_MESSAGE =
  '\u0421\u0435\u0439\u0447\u0430\u0441 \u0438\u0434\u0451\u0442 \u043e\u0442\u043a\u0440\u044b\u0442\u0430\u044f beta-\u0441\u0442\u0430\u0434\u0438\u044f: \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u044b \u0431\u044b\u0441\u0442\u0440\u044b\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f, \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0435 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f \u0438 \u043c\u0435\u043b\u043a\u0438\u0435 \u0441\u0431\u043e\u0438. \u0415\u0441\u043b\u0438 \u0437\u0430\u043c\u0435\u0442\u0438\u0442\u0435 \u043e\u0448\u0438\u0431\u043a\u0443, \u0431\u0430\u0433 \u0438\u043b\u0438 \u0441\u0442\u0440\u0430\u043d\u043d\u043e\u0435 \u043f\u043e\u0432\u0435\u0434\u0435\u043d\u0438\u0435, \u043d\u0435\u0437\u0430\u043c\u0435\u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u043f\u0438\u0448\u0438\u0442\u0435 \u0432 \u0422\u0435\u0445\u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0443.';
const MAINTENANCE_TITLE =
  '\u0421\u0435\u0439\u0447\u0430\u0441 \u0438\u0434\u0443\u0442 \u0442\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0440\u0430\u0431\u043e\u0442\u044b';
const MAINTENANCE_FALLBACK_MESSAGE =
  '\u0427\u0430\u0441\u0442\u044c \u0444\u0443\u043d\u043a\u0446\u0438\u0439 \u043c\u043e\u0436\u0435\u0442 \u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c \u043c\u0435\u0434\u043b\u0435\u043d\u043d\u0435\u0435 \u0438\u043b\u0438 \u0431\u044b\u0442\u044c \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.';
const SUPPORT_BUTTON_LABEL =
  '\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0432 \u0422\u0435\u0445\u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0443';
const CLOSE_LABEL =
  '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435';
const TECHWORKS_BADGE =
  '\u0422\u0435\u0445\u0440\u0430\u0431\u043e\u0442\u044b';

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
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceStatus | null>(null);
  const [dismissedMaintenanceId, setDismissedMaintenanceId] = useState<string | null>(null);
  const [betaDismissed, setBetaDismissed] = useState(false);

  const syncDismissState = useCallback(() => {
    if (typeof window === 'undefined') return;
    setDismissedMaintenanceId(localStorage.getItem(DISMISSED_MAINTENANCE_KEY));
    setBetaDismissed(localStorage.getItem(DISMISSED_BETA_NOTICE_KEY) === '1');
  }, []);

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      const response = await api('/api/maintenance/status', 'GET');
      const data = response?.isActive
        ? {
            isActive: true,
            message: response.message || '',
            timestamp: response.timestamp || '',
            id: response.id || '',
          }
        : null;

      setMaintenance(data);
      setMaintenanceData(data);
    } catch {
      setMaintenance(null);
      setMaintenanceData(null);
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

  const activeNotice = useMemo<BannerNotice | null>(() => {
    if (maintenanceData?.isActive && maintenanceData.id && dismissedMaintenanceId !== maintenanceData.id) {
      return {
        kind: 'maintenance',
        id: maintenanceData.id,
        title: MAINTENANCE_TITLE,
        message: maintenanceData.message || MAINTENANCE_FALLBACK_MESSAGE,
        timestamp: maintenanceData.timestamp,
      };
    }

    if (!maintenanceData?.isActive && !betaDismissed) {
      return readPendingBetaNotice();
    }

    return null;
  }, [betaDismissed, dismissedMaintenanceId, maintenanceData]);

  const palette = activeNotice?.kind === 'maintenance'
    ? {
        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.96) 0%, rgba(255, 138, 0, 0.96) 100%)',
        foreground: '#0f172a',
        badgeBackground: 'rgba(15, 23, 42, 0.12)',
        border: 'rgba(255,255,255,0.24)',
        icon: <Wrench size={22} strokeWidth={2.4} />,
        shadow: '0 14px 36px rgba(255, 138, 0, 0.28)',
      }
    : {
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.96) 0%, rgba(14, 165, 233, 0.96) 100%)',
        foreground: '#eff6ff',
        badgeBackground: 'rgba(255,255,255,0.16)',
        border: 'rgba(255,255,255,0.18)',
        icon: <FlaskConical size={22} strokeWidth={2.2} />,
        shadow: '0 14px 36px rgba(14, 165, 233, 0.24)',
      };

  const dismissNotice = useCallback(() => {
    if (typeof window === 'undefined' || !activeNotice) return;

    if (activeNotice.kind === 'maintenance') {
      localStorage.setItem(DISMISSED_MAINTENANCE_KEY, activeNotice.id);
      setDismissedMaintenanceId(activeNotice.id);
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

  if (!activeNotice) {
    return null;
  }

  return (
    <AnimatePresence>
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
                {activeNotice.kind === 'maintenance' ? TECHWORKS_BADGE : 'Beta'}
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
