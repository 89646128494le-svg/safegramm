import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import { useTranslation } from '../i18n';

const STORAGE_KEY = 'safegram_onboarding_e2ee_seen';

export default function OnboardingE2EE() {
  const { t, locale } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return;
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = (save: boolean) => {
    try {
      if (save && dontShowAgain) localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="onboarding-e2ee-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={() => dismiss(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--panel-1, #1a1f35)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 420,
            width: '100%',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
          }}
          role="dialog"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-desc"
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 12, background: 'rgba(124, 108, 255, 0.2)' }}>
                <Lock size={24} color="var(--accent, #7c6cff)" aria-hidden />
              </div>
              <h2 id="onboarding-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {t('security.e2ee')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dismiss(false)}
              aria-label={t('common.close')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={20} />
            </button>
          </div>
          <p id="onboarding-desc" style={{ margin: '0 0 20px', color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: 14 }}>
            {locale === 'ru' && 'Сообщения шифруются на вашем устройстве. Сервер не хранит ключи и не может прочитать переписку. Доверяйте только своему ключу и не передавайте его никому.'}
            {locale === 'en' && 'Messages are encrypted on your device. The server does not store keys and cannot read your chats. Only trust your own key and never share it.'}
            {locale === 'de' && 'Nachrichten werden auf Ihrem Gerät verschlüsselt. Der Server speichert keine Schlüssel und kann Chats nicht lesen. Vertrauen Sie nur Ihrem Schlüssel und teilen Sie ihn nie.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="dont-show"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                aria-describedby="onboarding-desc"
              />
              <span>{locale === 'ru' ? 'Больше не показывать' : locale === 'de' ? 'Nicht mehr anzeigen' : "Don't show again"}</span>
            </label>
            <button
              type="button"
              onClick={() => dismiss(true)}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent, #7c6cff)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {t('common.ok')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
