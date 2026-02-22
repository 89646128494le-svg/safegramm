import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { getApiBaseUrl } from '../../services/api';
import { showToast } from '../Toast';

const POLL_MS = 8000;
const SEVERITY_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  critical: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.6)', label: 'Критическое' },
  moderation: { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.5)', label: 'Модерация' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.4)', label: 'Инфо' },
};

export interface AuditLogEntry {
  timestamp: number;
  adminId: string;
  adminName?: string;
  actionType: string;
  targetId?: string;
  targetName?: string;
  reason?: string;
  severity: string;
  extra?: string;
}

export default function LiveLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastCriticalTs = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/admin/audit-logs?limit=300');
      const list = (data?.logs || []) as AuditLogEntry[];
      setLogs(list);
      setError(null);
      const critical = list.find((l) => l.severity === 'critical');
      if (critical && critical.timestamp > lastCriticalTs.current && lastCriticalTs.current > 0) {
        const msg = critical.reason || `${critical.actionType}: ${critical.adminName || critical.adminId} → ${critical.targetName || critical.targetId || ''}`;
        showToast(`Критическое: ${msg}`, 'error');
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('SafeGram — Критическое событие', { body: msg, tag: 'safegram-critical' });
        }
      }
      const latest = list[0];
      if (latest?.severity === 'critical') lastCriticalTs.current = latest.timestamp;
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки логов');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const exportAudit = async () => {
    try {
      const base = getApiBaseUrl();
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${base}/api/admin/audit-logs?limit=5000&export=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safegram-audit-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Логи выгружены', 'success');
    } catch (e: any) {
      showToast('Ошибка выгрузки: ' + e.message, 'error');
    }
  };

  const style = (severity: string) => SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;

  return (
    <div
      style={{
        marginTop: '24px',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        overflow: 'hidden',
        boxShadow: '0 0 24px rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
          background: 'rgba(30, 41, 59, 0.4)',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
          Live Logs — Intelligence Center
        </h4>
        <button
          type="button"
          onClick={exportAudit}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontFamily: 'ui-monospace, monospace',
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#93c5fd',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Export for Audit
        </button>
      </div>
      <div
        ref={scrollRef}
        style={{
          height: '360px',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollBehavior: 'smooth',
          padding: '12px',
          fontFamily: 'ui-monospace, "SF Mono", "Consolas", monospace',
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        {loading && logs.length === 0 && <div style={{ color: 'var(--subtle)', padding: '24px' }}>Загрузка...</div>}
        {error && <div style={{ color: '#f87171', padding: '12px' }}>{error}</div>}
        {logs.map((log, i) => {
          const s = style(log.severity);
          return (
            <div
              key={`${log.timestamp}-${i}`}
              style={{
                padding: '10px 12px',
                marginBottom: '8px',
                background: s.bg,
                borderLeft: `3px solid ${s.border}`,
                borderRadius: '6px',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--subtle)', fontSize: '11px' }}>
                  {new Date(log.timestamp).toLocaleString('ru-RU')}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: s.border,
                    color: log.severity === 'critical' ? '#fef2f2' : 'inherit',
                  }}
                >
                  [{s.label}]
                </span>
                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{log.actionType}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                {log.adminName || log.adminId} → {log.targetName || log.targetId || '—'} {log.reason && `· ${log.reason}`}
                {log.extra && ` · ${log.extra}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
