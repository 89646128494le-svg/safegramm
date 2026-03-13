import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Info, Loader, Siren, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

type Severity = 'info' | 'success' | 'warning' | 'critical';

interface BannerPayload {
  enabled?: boolean;
  isActive?: boolean;
  id?: string;
  title?: string;
  message?: string;
  severity?: Severity;
  dismissible?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

const SEVERITY_META: Record<Severity, { label: string; color: string; glow: string; icon: React.ReactNode }> = {
  info: {
    label: 'Информационная',
    color: '#60a5fa',
    glow: 'rgba(96,165,250,0.18)',
    icon: <Info size={18} />,
  },
  success: {
    label: 'Позитивная',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.18)',
    icon: <CheckCircle2 size={18} />,
  },
  warning: {
    label: 'Предупреждение',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.18)',
    icon: <AlertTriangle size={18} />,
  },
  critical: {
    label: 'Критическая',
    color: '#f87171',
    glow: 'rgba(248,113,113,0.18)',
    icon: <Siren size={18} />,
  },
};

const EMPTY_STATE: Required<Pick<BannerPayload, 'title' | 'message' | 'severity' | 'dismissible'>> & Pick<BannerPayload, 'startsAt' | 'endsAt'> = {
  title: '',
  message: '',
  severity: 'info',
  dismissible: false,
  startsAt: '',
  endsAt: '',
};

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatSchedule(startsAt?: string | null, endsAt?: string | null) {
  const parts: string[] = [];
  if (startsAt) parts.push(`с ${new Date(startsAt).toLocaleString('ru-RU')}`);
  if (endsAt) parts.push(`до ${new Date(endsAt).toLocaleString('ru-RU')}`);
  return parts.join(' ');
}

export default function SystemBannerManager() {
  const [form, setForm] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentBanner, setCurrentBanner] = useState<BannerPayload | null>(null);

  const meta = useMemo(() => SEVERITY_META[form.severity], [form.severity]);

  const loadBanner = async () => {
    try {
      setLoading(true);
      const response = await api('/api/admin/system-banner', 'GET');
      const hasBanner = Boolean(response?.enabled || response?.message || response?.title);
      setCurrentBanner(hasBanner ? response : null);
      setForm({
        title: response?.title || '',
        message: response?.message || '',
        severity: (response?.severity as Severity) || 'info',
        dismissible: Boolean(response?.dismissible),
        startsAt: toDatetimeLocal(response?.startsAt),
        endsAt: toDatetimeLocal(response?.endsAt),
      });
    } catch (error: any) {
      showToast('Не удалось загрузить системную панель: ' + error.message, 'error');
      setCurrentBanner(null);
      setForm(EMPTY_STATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanner();
  }, []);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveBanner = async () => {
    if (!form.message.trim()) {
      showToast('Введите текст панели', 'warning');
      return;
    }
    setSaving(true);
    try {
      await api('/api/admin/system-banner', 'POST', {
        title: form.title.trim(),
        message: form.message.trim(),
        severity: form.severity,
        dismissible: form.dismissible,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
      });
      showToast('Системная панель сохранена', 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('system-banner-updated'));
      }
      await loadBanner();
    } catch (error: any) {
      showToast('Не удалось сохранить системную панель: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const disableBanner = async () => {
    setSaving(true);
    try {
      await api('/api/admin/system-banner/disable', 'POST');
      showToast('Системная панель отключена', 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('system-banner-updated'));
      }
      setCurrentBanner(null);
      setForm(EMPTY_STATE);
    } catch (error: any) {
      showToast('Не удалось отключить системную панель: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="empty" style={{ padding: '48px' }}>Загрузка панели...</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(124,108,255,0.12), rgba(61,216,255,0.08))',
          border: '1px solid rgba(124,108,255,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <BellRing size={22} color="#a78bfa" />
          <strong style={{ color: 'var(--fg)' }}>Глобальная системная панель</strong>
        </div>
        <div style={{ color: 'var(--subtle)', lineHeight: 1.6 }}>
          Эта панель показывается по всему сайту. Здесь можно задать важность сообщения, период показа и возможность закрытия пользователем.
        </div>
      </div>

      {currentBanner?.enabled && (
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <strong style={{ color: 'var(--fg)' }}>Текущая панель</strong>
            <span style={{ color: currentBanner.isActive ? '#34d399' : '#fbbf24', fontSize: 13, fontWeight: 600 }}>
              {currentBanner.isActive ? 'Показывается сейчас' : 'Запланирована или уже завершена'}
            </span>
          </div>
          <div style={{ color: 'var(--fg)', fontWeight: 600, marginBottom: 6 }}>
            {currentBanner.title || 'Без отдельного заголовка'}
          </div>
          <div style={{ color: 'var(--subtle)', marginBottom: 10, lineHeight: 1.55 }}>
            {currentBanner.message}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--subtle)' }}>
            <span>Важность: {SEVERITY_META[(currentBanner.severity as Severity) || 'info'].label}</span>
            <span>Закрываемая: {currentBanner.dismissible ? 'да' : 'нет'}</span>
            {formatSchedule(currentBanner.startsAt, currentBanner.endsAt) && (
              <span>{formatSchedule(currentBanner.startsAt, currentBanner.endsAt)}</span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)' }}>
        <section
          style={{
            padding: 20,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'grid',
            gap: 16,
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--fg)', fontWeight: 600 }}>Заголовок</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Например: Важное обновление SafeGram"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--fg)', fontWeight: 600 }}>Сообщение</label>
            <textarea
              value={form.message}
              onChange={(e) => updateField('message', e.target.value)}
              rows={5}
              placeholder="Коротко объясните, что происходит и что нужно знать пользователю."
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--fg)', fontWeight: 600 }}>Важность</label>
              <select value={form.severity} onChange={(e) => updateField('severity', e.target.value as Severity)} style={inputStyle}>
                <option value="info">Информационная</option>
                <option value="success">Позитивная</option>
                <option value="warning">Предупреждение</option>
                <option value="critical">Критическая</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg)', fontWeight: 600, paddingTop: 34 }}>
              <input
                type="checkbox"
                checked={form.dismissible}
                onChange={(e) => updateField('dismissible', e.target.checked)}
              />
              Разрешить закрыть
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--fg)', fontWeight: 600 }}>Показывать с</label>
              <input type="datetime-local" value={form.startsAt || ''} onChange={(e) => updateField('startsAt', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--fg)', fontWeight: 600 }}>Скрыть после</label>
              <input type="datetime-local" value={form.endsAt || ''} onChange={(e) => updateField('endsAt', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={saveBanner} disabled={saving} style={primaryButtonStyle}>
              {saving ? <Loader size={18} className="spin" /> : <BellRing size={18} />}
              {currentBanner?.enabled ? 'Обновить панель' : 'Включить панель'}
            </button>
            <button type="button" onClick={disableBanner} disabled={saving || !currentBanner?.enabled} style={dangerButtonStyle}>
              <XCircle size={18} />
              Отключить
            </button>
          </div>
        </section>

        <section
          style={{
            padding: 20,
            borderRadius: 18,
            background: meta.glow,
            border: `1px solid ${meta.color}55`,
            boxShadow: `0 12px 30px ${meta.glow}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: meta.color, fontWeight: 700, marginBottom: 10 }}>
            {meta.icon}
            Предпросмотр
          </div>
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'rgba(10,15,30,0.72)',
              border: `1px solid ${meta.color}33`,
              color: '#e9ecf5',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 700 }}>
              {meta.icon}
              {form.title.trim() || 'Заголовок будет подставлен автоматически'}
            </div>
            <div style={{ color: '#cbd5e1', lineHeight: 1.55, marginBottom: 10 }}>
              {form.message.trim() || 'Текст панели появится здесь.'}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#94a3b8' }}>
              <span>{meta.label}</span>
              <span>{form.dismissible ? 'Можно закрыть' : 'Закрыть нельзя'}</span>
              {formatSchedule(form.startsAt, form.endsAt) && <span>{formatSchedule(form.startsAt, form.endsAt)}</span>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--panel-2, #111827)',
  border: '1px solid var(--border, #374151)',
  borderRadius: 12,
  color: 'var(--fg, #e5e7eb)',
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #7c6cff, #3dd8ff)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 16px',
  background: 'rgba(239,68,68,0.14)',
  color: '#fda4af',
  border: '1px solid rgba(239,68,68,0.24)',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 700,
};
