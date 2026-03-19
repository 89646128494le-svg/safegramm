import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  ShieldAlert,
  Siren,
  Wrench,
} from 'lucide-react';
import { api, humanFriendlyMessage } from '../services/api';

type MaintenancePayload = {
  isActive?: boolean;
  enabled?: boolean;
  message?: string;
  timestamp?: string;
  id?: string;
  createdAt?: string;
};

type SystemBannerPayload = {
  isActive?: boolean;
  enabled?: boolean;
  title?: string;
  message?: string;
  severity?: 'info' | 'success' | 'warning' | 'critical';
  startsAt?: string;
  endsAt?: string;
};

type PublicStatusSummary = {
  status?: string;
  generatedAt?: string;
  api?: {
    ok?: boolean;
    error?: string;
  };
  maintenance?: MaintenancePayload;
  systemBanner?: SystemBannerPayload;
};

const POLL_INTERVAL_MS = 15_000;

function formatTimestamp(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ru-RU');
}

export default function Status() {
  const [summary, setSummary] = useState<PublicStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailableMessage, setUnavailableMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await api('/api/status/summary');
        if (cancelled) return;
        setSummary(data || null);
        setUnavailableMessage('');
      } catch (error: any) {
        if (cancelled) return;
        setSummary(null);
        setUnavailableMessage(humanFriendlyMessage(error?.message || ''));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const maintenance = summary?.maintenance;
  const systemBanner = summary?.systemBanner;
  const isUnavailable = !loading && !summary;
  const isDegraded = !loading && !!summary && summary.api?.ok === false;
  const isMaintenance = !isUnavailable && !isDegraded && (!!maintenance?.isActive || !!maintenance?.enabled);
  const hasSystemBanner =
    !isUnavailable && !isDegraded && !isMaintenance && (!!systemBanner?.isActive || !!systemBanner?.enabled);

  const view = useMemo(() => {
    if (isUnavailable) {
      return {
        eyebrow: 'Статус недоступен',
        icon: <Siren size={22} />,
        title: 'SafeGram сейчас недоступен',
        message:
          unavailableMessage ||
          'Не удалось получить ответ от API SafeGram. Попробуйте обновить страницу немного позже.',
        accent: '#f97316',
        background:
          'linear-gradient(135deg, rgba(127, 29, 29, 0.9) 0%, rgba(154, 52, 18, 0.9) 100%)',
      };
    }

    if (isDegraded) {
      return {
        eyebrow: 'Частичная деградация',
        icon: <Siren size={22} />,
        title: 'SafeGram работает нестабильно',
        message:
          summary?.api?.error
            ? `Часть backend-функций отвечает нестабильно. Внутренний статус API: ${summary.api.error}.`
            : 'Часть backend-функций отвечает нестабильно. Повторите попытку немного позже.',
        accent: '#f97316',
        background:
          'linear-gradient(135deg, rgba(124, 45, 18, 0.92) 0%, rgba(234, 88, 12, 0.92) 100%)',
      };
    }

    if (isMaintenance) {
      return {
        eyebrow: 'Техработы',
        icon: <Wrench size={22} />,
        title: 'SafeGram временно на техработах',
        message:
          maintenance?.message ||
          'Часть функций временно ограничена. Проверяйте эту страницу статуса перед повторной попыткой входа.',
        accent: '#fbbf24',
        background:
          'linear-gradient(135deg, rgba(180, 83, 9, 0.92) 0%, rgba(245, 158, 11, 0.92) 100%)',
      };
    }

    if (hasSystemBanner) {
      const severity = systemBanner?.severity || 'info';
      const palette =
        severity === 'critical'
          ? {
              accent: '#fb7185',
              background:
                'linear-gradient(135deg, rgba(136, 19, 55, 0.92) 0%, rgba(225, 29, 72, 0.92) 100%)',
            }
          : severity === 'warning'
            ? {
                accent: '#fbbf24',
                background:
                  'linear-gradient(135deg, rgba(146, 64, 14, 0.92) 0%, rgba(245, 158, 11, 0.92) 100%)',
              }
            : severity === 'success'
              ? {
                  accent: '#34d399',
                  background:
                    'linear-gradient(135deg, rgba(6, 95, 70, 0.92) 0%, rgba(16, 185, 129, 0.92) 100%)',
                }
              : {
                  accent: '#60a5fa',
                  background:
                    'linear-gradient(135deg, rgba(30, 58, 138, 0.92) 0%, rgba(59, 130, 246, 0.92) 100%)',
                };

      return {
        eyebrow: 'Системное сообщение',
        icon: <AlertTriangle size={22} />,
        title: systemBanner?.title || 'Есть важное объявление SafeGram',
        message: systemBanner?.message || 'Для пользователей опубликовано системное уведомление.',
        accent: palette.accent,
        background: palette.background,
      };
    }

    return {
      eyebrow: 'Сервис в норме',
      icon: <CheckCircle2 size={22} />,
      title: 'SafeGram работает штатно',
      message: 'Сайт, API и основные пользовательские сценарии сейчас доступны в обычном режиме.',
      accent: '#60a5fa',
      background:
        'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 64, 175, 0.92) 100%)',
    };
  }, [hasSystemBanner, isDegraded, isMaintenance, isUnavailable, maintenance?.message, summary?.api?.error, systemBanner?.message, systemBanner?.severity, systemBanner?.title, unavailableMessage]);

  const cards = [
    {
      label: 'API',
      value: isUnavailable ? 'Недоступен' : isDegraded ? 'Деградация' : summary?.api?.ok ? 'Работает' : 'Проверка',
      tone: isUnavailable ? '#f97316' : isDegraded ? '#f97316' : '#34d399',
    },
    {
      label: 'Вход и регистрация',
      value: isUnavailable ? 'Неизвестно' : isMaintenance ? 'Ограничено' : isDegraded ? 'С перебоями' : 'Доступно',
      tone: isUnavailable ? '#f97316' : isMaintenance ? '#fbbf24' : isDegraded ? '#f97316' : '#34d399',
    },
    {
      label: 'Системные уведомления',
      value: hasSystemBanner ? 'Есть активное' : 'Нет активных',
      tone: hasSystemBanner ? '#fbbf24' : '#60a5fa',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, rgba(37,99,235,0.22), transparent 35%), linear-gradient(180deg, #050816 0%, #091228 100%)',
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
          maxWidth: 940,
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
            color: view.accent,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {view.icon}
          {view.eyebrow}
        </div>

        <div style={{ padding: 28 }}>
          <div
            style={{
              padding: 24,
              borderRadius: 24,
              background: view.background,
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 20px 48px rgba(15, 23, 42, 0.35)',
            }}
          >
            <h1 style={{ margin: '0 0 14px', fontSize: 42, lineHeight: 1.05, fontWeight: 900 }}>
              {loading ? 'Проверяем состояние SafeGram…' : view.title}
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: 18,
                lineHeight: 1.65,
                color: 'rgba(241, 245, 249, 0.92)',
                maxWidth: 720,
              }}
            >
              {loading ? 'Получаем актуальный статус сайта, API и доступности входа.' : view.message}
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
              {maintenance?.timestamp && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(241, 245, 249, 0.88)',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  <Clock3 size={16} />
                  {maintenance.timestamp}
                </div>
              )}

              {summary?.generatedAt && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(241, 245, 249, 0.88)',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  <Clock3 size={16} />
                  Обновлено {formatTimestamp(summary.generatedAt)}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {cards.map((card) => (
              <div
                key={card.label}
                style={{
                  padding: 18,
                  borderRadius: 20,
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: 'rgba(148, 163, 184, 0.9)',
                  }}
                >
                  {card.label}
                </div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: card.tone }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 22,
              padding: 20,
              borderRadius: 22,
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.68))',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              color: 'rgba(226, 232, 240, 0.84)',
              lineHeight: 1.7,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontWeight: 800 }}>
              <ShieldAlert size={18} color="#f59e0b" />
              Что сейчас доступно
            </div>
            {isUnavailable ? (
              <>
                <div>Страница статуса открывается, но публичное API сейчас не отвечает.</div>
                <div>Обновите страницу позже. Если проблема держится долго, напишите в техподдержку SafeGram.</div>
              </>
            ) : isDegraded ? (
              <>
                <div>Основной сайт может открываться, но часть API-сценариев работает нестабильно.</div>
                <div>Если не удаётся войти, зарегистрироваться или отправить запрос, попробуйте повторить попытку через несколько минут.</div>
              </>
            ) : isMaintenance ? (
              <>
                <div>Во время техработ часть функций может быть временно закрыта для обычных пользователей.</div>
                <div>Если у вас нет служебного доступа, дождитесь окончания работ и проверьте статус позже.</div>
              </>
            ) : (
              <>
                <div>Если вы видите эту страницу и статус зелёный, значит публичные веб-сценарии работают нормально.</div>
                <div>Если проблема наблюдается только у вас, проверьте сеть, VPN и затем обновите страницу.</div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 14,
                fontWeight: 800,
                color: '#e6eefc',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                cursor: 'pointer',
              }}
            >
              <RefreshCcw size={16} />
              Обновить статус
            </button>
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
