import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock3, ShieldAlert, Wrench } from 'lucide-react';
import { api } from '../services/api';

type MaintenancePayload = {
  isActive?: boolean;
  enabled?: boolean;
  message?: string;
  timestamp?: string;
};

export default function Status() {
  const [status, setStatus] = useState<MaintenancePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api('/api/maintenance/status')
      .then((data) => {
        if (!cancelled) setStatus(data || null);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = !!status?.isActive || !!status?.enabled;
  const title = isActive ? 'SafeGram временно на техработах' : 'Статус SafeGram';
  const message = isActive
    ? status?.message || 'Часть функций временно недоступна. Проверьте страницу статуса позже.'
    : 'Система работает в штатном режиме.';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, rgba(37,99,235,0.22), transparent 35%), linear-gradient(180deg, #050816 0%, #091228 100%)',
        color: '#e6eefc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 860,
          borderRadius: 28,
          border: '1px solid rgba(148, 163, 184, 0.18)',
          background: 'rgba(9, 18, 40, 0.82)',
          boxShadow: '0 28px 90px rgba(2, 6, 23, 0.5)',
          overflow: 'hidden',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div
          style={{
            padding: '28px 28px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: isActive ? '#fbbf24' : '#60a5fa',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {isActive ? <Wrench size={18} /> : <ShieldAlert size={18} />}
          {isActive ? 'Техработы' : 'Статус'}
        </div>

        <div style={{ padding: 28 }}>
          <h1 style={{ margin: '0 0 14px', fontSize: 42, lineHeight: 1.05, fontWeight: 900 }}>
            {title}
          </h1>

          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: 'rgba(226, 232, 240, 0.88)', maxWidth: 680 }}>
            {loading ? 'Проверяем актуальный статус сервиса...' : message}
          </p>

          {status?.timestamp && (
            <div
              style={{
                marginTop: 18,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                color: 'rgba(226, 232, 240, 0.84)',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <Clock3 size={16} />
              {status.timestamp}
            </div>
          )}

          <div
            style={{
              marginTop: 24,
              padding: 20,
              borderRadius: 22,
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.68))',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              color: 'rgba(226, 232, 240, 0.84)',
              lineHeight: 1.7,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontWeight: 800 }}>
              <AlertTriangle size={18} color="#f59e0b" />
              Что сейчас доступно
            </div>
            <div>Страница статуса остаётся открытой всегда.</div>
            <div>Доступ во время техработ сохранён только для служебных аккаунтов.</div>
            <div>Если у вас нет служебного доступа, дождитесь окончания работ и проверьте статус позже.</div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 16px',
                borderRadius: 14,
                textDecoration: 'none',
                fontWeight: 800,
                color: '#e6eefc',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
              }}
            >
              На главную
            </Link>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 16px',
                borderRadius: 14,
                textDecoration: 'none',
                fontWeight: 800,
                color: '#081120',
                background: 'linear-gradient(135deg, #f8fafc, #dbeafe)',
              }}
            >
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
