
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiBaseUrl, getErrorMessage, setAdmin2FAToken } from '../../services/api';
import { showToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/Modal';
import ServiceManager from '../../components/ServiceManager';
import WebhookManager from '../../components/WebhookManager';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard';
import BanMuteManager from '../../components/admin/BanMuteManager';
import MaintenanceManager from '../../components/admin/MaintenanceManager';
import BroadcastManager from '../../components/admin/BroadcastManager';
import AdminLogs from '../../components/admin/AdminLogs';
import SystemMonitor from '../../components/admin/SystemMonitor';
import AdminMessaging from '../../components/admin/AdminMessaging';
import AnonymousDMTab from '../../components/admin/AnonymousDMTab';
import SecurityDashboard from '../../components/admin/SecurityDashboard';
import SupportTab from '../../components/admin/SupportTab';
import LiveLogs from '../../components/admin/LiveLogs';
import AuditLogTab from '../../components/admin/AuditLogTab';
import ContentModerationTab from '../../components/admin/ContentModerationTab';
import SecurityPolicyTab from '../../components/admin/SecurityPolicyTab';
import CommunicationTab from '../../components/admin/CommunicationTab';
import SystemIntegrationsTab from '../../components/admin/SystemIntegrationsTab';
import AnalyticsReportsTab from '../../components/admin/AnalyticsReportsTab';
import { ADMIN_TABS, ADMIN_SECTIONS, canAccessAdminTab, getRoleLabel, getRoleLevel, getDefaultAdminTab, getPrimaryRoleName, getEffectiveRoles, getStaffRoleOptions, isSystemOwner, canBlockUser, canDemoteUser, canPromoteTo, canDeleteUser, ROLE_LEVEL } from '../../utils/roles';

type AdminTabId = typeof ADMIN_TABS[number]['id'];

type AdminGate = 'loading' | 'no_2fa' | 'need_code' | 'verified';

export default function Admin() {
  const [tab, setTab] = useState<AdminTabId>('sysadmin_users');
  const [user, setUser] = useState<any>(null);
  const [adminGate, setAdminGate] = useState<AdminGate>('loading');
  const [twoFACode, setTwoFACode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const loadUser = async () => {
    try {
      const u = await api('/api/users/me');
      setUser(u);
      const defaultTab = getDefaultAdminTab(u);
      if (defaultTab && canAccessAdminTab(u, defaultTab)) {
        setTab(defaultTab);
        return;
      }
      const firstTab = ADMIN_TABS.find((t) => canAccessAdminTab(u, t.id));
      if (firstTab) setTab(firstTab.id);
    } catch (e) {
      console.error('Failed to load user:', e);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!user || adminGate !== 'loading') return;
    if (!ADMIN_TABS.some((t) => canAccessAdminTab(user, t.id))) {
      setAdminGate('verified');
      return;
    }
    api('/api/admin/2fa-status')
      .then((status: any) => {
        if (!status.twoFactorEnabled) {
          setAdminGate('no_2fa');
          return;
        }
        return api('/api/admin/me/preferences').then(() => setAdminGate('verified'));
      })
      .catch((e: any) => {
        if (e?.status === 404) {
          setAdminGate('verified');
          return;
        }
        const err = e?.response ?? e?.responseData ?? e?.body ?? {};
        if (e?.status === 401 && err?.error === 'admin_2fa_verify_required') setAdminGate('need_code');
        else setAdminGate('need_code');
      });
  }, [user, adminGate]);

  const submit2FACode = async () => {
    const code = twoFACode.trim().replace(/\s/g, '');
    if (!code || code.length < 6) {
      showToast('Введите 6-значный код из приложения', 'error');
      return;
    }
    setVerifying(true);
    try {
      const data = await api('/api/admin/verify-2fa', 'POST', { code });
      if (data.token) {
        setAdmin2FAToken(data.token);
        setAdminGate('verified');
        setTwoFACode('');
        showToast('Вход в админку выполнен', 'success');
      }
    } catch (e: any) {
      const err = e?.response ?? e?.responseData ?? e?.body ?? {};
      if (err.error === 'invalid_code') showToast('Неверный код. Проверьте и введите снова.', 'error');
      else showToast(getErrorMessage(e, 'Не удалось войти'), 'error');
    } finally {
      setVerifying(false);
    }
  };

  const visibleTabs = React.useMemo(
    () => ADMIN_TABS.filter((t) => user && canAccessAdminTab(user, t.id)),
    [user]
  );

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);

  const roleLabel = user ? getRoleLabel(user) : '';
  const primaryRole = user ? getPrimaryRoleName(user) : 'user';
  const roleBadgeStyle =
    primaryRole === 'owner'
      ? { background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.2))', border: '1px solid rgba(251,191,36,0.4)', color: '#fcd34d' }
      : primaryRole === 'sysadmin'
      ? { background: 'linear-gradient(135deg, rgba(124,108,255,0.2), rgba(61,216,255,0.15))', border: '1px solid rgba(124,108,255,0.35)', color: '#a5b4fc' }
      : primaryRole === 'release_manager'
      ? { background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.3)', color: '#93c5fd' }
      : primaryRole === 'billing_manager'
      ? { background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7' }
      : primaryRole === 'safety'
      ? { background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }
      : primaryRole === 'risk_analyst'
      ? { background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.3)', color: '#7dd3fc' }
      : primaryRole === 'moderator'
      ? { background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }
      : primaryRole === 'support_lead'
      ? { background: 'rgba(192,132,252,0.14)', border: '1px solid rgba(192,132,252,0.3)', color: '#d8b4fe' }
      : primaryRole === 'support_l1'
      ? { background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }
      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--subtle, #9ca3af)' };
  const roleBadgeIcon =
    primaryRole === 'owner' ? '👑' :
    primaryRole === 'sysadmin' ? '⚙️' :
    primaryRole === 'release_manager' ? '🚀' :
    primaryRole === 'billing_manager' ? '💳' :
    primaryRole === 'safety' ? '🧿' :
    primaryRole === 'risk_analyst' ? '📡' :
    primaryRole === 'moderator' ? '🛡️' :
    primaryRole === 'support_lead' ? '🎧' :
    primaryRole === 'support_l1' ? '🎫' :
    '';

  if (adminGate === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #05060c)' }}>
        <div className="empty" style={{ color: 'var(--subtle)' }}>Загрузка…</div>
      </div>
    );
  }

  if (adminGate === 'no_2fa') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #05060c)', padding: '24px' }}>
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: 'var(--fg)' }}>Требуется двухфакторная аутентификация</h2>
          <p style={{ color: 'var(--subtle)', marginBottom: '24px', lineHeight: 1.5 }}>
            Для доступа в админку необходимо включить двухфакторную аутентификацию в настройках.
          </p>
          <Link to="/app/settings" style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--accent, #3b82f6)', color: '#fff', borderRadius: '8px', fontWeight: '600', textDecoration: 'none' }}>
            Перейти в Настройки → Безопасность
          </Link>
        </div>
      </div>
    );
  }

  if (adminGate === 'need_code') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #05060c)', padding: '24px' }}>
        <div style={{ maxWidth: '360px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>🔐</div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: 'var(--fg)', textAlign: 'center' }}>Вход в админку</h2>
          <p style={{ color: 'var(--subtle)', marginBottom: '24px', textAlign: 'center', fontSize: '14px' }}>
            Введите код из приложения двухфакторной аутентификации
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
            value={twoFACode}
            onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && submit2FACode()}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: '18px',
              letterSpacing: '0.3em',
              textAlign: 'center',
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--fg)',
              marginBottom: '16px',
            }}
          />
          <button
            type="button"
            onClick={submit2FACode}
            disabled={verifying || twoFACode.replace(/\D/g, '').length < 6}
            style={{
              width: '100%',
              padding: '14px',
              background: verifying ? 'var(--subtle)' : 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: verifying ? 'not-allowed' : 'pointer',
            }}
          >
            {verifying ? 'Проверка…' : 'Войти'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-root" style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: 0,
        background: 'var(--bg, #05060c)',
      }}>
      <aside className="admin-sidebar" style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        background: 'rgba(11, 16, 32, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 6px', color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            Панель управления
          </h1>
          {roleLabel && (
            <span style={{ fontSize: '12px', fontWeight: '500', padding: '4px 10px', borderRadius: '20px', ...roleBadgeStyle }}>
              {roleBadgeIcon ? `${roleBadgeIcon} ${roleLabel}` : roleLabel}
            </span>
          )}
        </div>
        <nav style={{ flex: 1, padding: '0 12px' }}>
          {ADMIN_SECTIONS.slice().sort((a, b) => a.order - b.order).map((section) => {
            const sectionTabs = visibleTabs.filter((t) => (t as typeof ADMIN_TABS[number]).section === section.id);
            if (sectionTabs.length === 0) return null;
            return (
              <div key={section.id} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--subtle, #6b7280)',
                  padding: '8px 14px 6px',
                  marginBottom: '4px',
                }}>
                  {section.label}
                </div>
                {sectionTabs.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className="admin-nav-item"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      marginBottom: '2px',
                      fontWeight: tab === id ? '600' : '500',
                      fontSize: '13px',
                      textAlign: 'left',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: tab === id
                        ? 'linear-gradient(135deg, var(--accent, #7c6cff), var(--accent-2, #3dd8ff))'
                        : 'transparent',
                      color: tab === id ? '#fff' : 'var(--fg, #e9ecf5)',
                      boxShadow: tab === id ? '0 4px 14px rgba(124, 108, 255, 0.35)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (tab !== id) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.color = 'var(--fg)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (tab !== id) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--fg)';
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <p style={{ padding: '12px 20px 0', margin: 0, fontSize: '11px', color: 'var(--subtle)', opacity: 0.8 }}>
          /app/admin
        </p>
      </aside>
      <main className="admin-main" style={{
        padding: '32px',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
      }}>
        <div className="admin-content-card" style={{
          background: 'rgba(11, 16, 32, 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '28px 32px',
          minHeight: '60vh',
          boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        }}>

      {tab==='support_l1_overview' && canAccessAdminTab(user, 'support_l1_overview') && (
        <RoleOverviewPanel
          title="Техподдержка L1"
          subtitle="Первая линия поддержки. Здесь обрабатывают новые тикеты, уточняют детали проблемы и контролируют SLA по ответам."
          accent="linear-gradient(135deg, rgba(139,92,246,0.18), rgba(59,130,246,0.14))"
          bullets={[
            'Принимайте новые обращения и доводите диагностику до понятного статуса.',
            'Собирайте важные детали бага и не теряйте контекст переписки.',
            'Контролируйте скорость ответа и качество коммуникации.',
          ]}
          actions={[
            { label: 'Открыть тикеты', tab: 'support_l1_tickets' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='support_l1_tickets' && canAccessAdminTab(user, 'support_l1_tickets') && <SupportTab />}

      {tab==='support_lead_overview' && canAccessAdminTab(user, 'support_lead_overview') && (
        <RoleOverviewPanel
          title="Лидер поддержки"
          subtitle="Координация работы поддержки. Следит за качеством сервиса, приоритетами тикетов и стабильностью работы команды."
          accent="linear-gradient(135deg, rgba(192,132,252,0.18), rgba(96,165,250,0.14))"
          bullets={[
            'Разбирайте эскалации от L1 и доводите запросы до решения.',
            'Держите в порядке фидбек и воронку набора тестеров.',
            'Следите за качеством ответов и скоростью реакции команды.',
          ]}
          actions={[
            { label: 'Открыть фидбек', tab: 'support_lead_feedback' },
            { label: 'Открыть набор тестеров', tab: 'support_lead_recruit' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='support_lead_feedback' && canAccessAdminTab(user, 'support_lead_feedback') && <FeedbackTab />}
      {tab==='support_lead_recruit' && canAccessAdminTab(user, 'support_lead_recruit') && <RecruitTab />}

      {tab==='moderator_overview' && canAccessAdminTab(user, 'moderator_overview') && (
        <RoleOverviewPanel
          title="Модерация"
          subtitle="Работа с жалобами, нарушениями правил, блокировками и очередью инцидентов."
          accent="linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.14))"
          bullets={[
            'Проверяйте жалобы пользователей и решения автоматических систем.',
            'Разбирайте репорты и применяйте санкции по правилам.',
            'Следите за качеством модерации и прозрачностью действий.',
          ]}
          actions={[
            { label: 'Открыть очередь', tab: 'moderator_queue' },
            { label: 'Открыть жалобы', tab: 'moderator_reports' },
            { label: 'Открыть баны и муты', tab: 'moderator_bans' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='moderator_queue' && canAccessAdminTab(user, 'moderator_queue') && <ModTab />}
      {tab==='moderator_reports' && canAccessAdminTab(user, 'moderator_reports') && <ReportsTab />}
      {tab==='moderator_bans' && canAccessAdminTab(user, 'moderator_bans') && <BanMuteManager />}
      {tab==='moderator_content' && canAccessAdminTab(user, 'moderator_content') && <ContentModerationTab />}

      {tab==='risk_overview' && canAccessAdminTab(user, 'risk_overview') && (
        <RoleOverviewPanel
          title="Риск и аналитика"
          subtitle="Мониторинг подозрительной активности, попыток обхода ограничений и поведенческих аномалий."
          accent="linear-gradient(135deg, rgba(56,189,248,0.2), rgba(14,165,233,0.14))"
          bullets={[
            'Отслеживайте входы по устройствам, IP и сессиям.',
            'Ищите повторяющиеся паттерны злоупотреблений и аномалий.',
            'Готовьте сигналы для службы безопасности и модерации.',
          ]}
          actions={[
            { label: 'Открыть риск-панель', tab: 'risk_dashboard' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='risk_dashboard' && canAccessAdminTab(user, 'risk_dashboard') && <SecurityDashboard />}

      {tab==='safety_overview' && canAccessAdminTab(user, 'safety_overview') && (
        <RoleOverviewPanel
          title="Безопасность"
          subtitle="Политики безопасности, high-risk события и контроль критических настроек."
          accent="linear-gradient(135deg, rgba(59,130,246,0.2), rgba(56,189,248,0.14))"
          bullets={[
            'Отслеживайте критичные события и оповещения по входам и сессиям.',
            'Проверяйте соблюдение политик и состояние защитных механизмов.',
            'Смотрите логи и историю действий по важным инцидентам.',
          ]}
          actions={[
            { label: 'Открыть панель', tab: 'safety_dashboard' },
            { label: 'Открыть политики', tab: 'safety_policy' },
            { label: 'Открыть логи', tab: 'safety_logs' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='safety_dashboard' && canAccessAdminTab(user, 'safety_dashboard') && <SecurityDashboard />}
      {tab==='safety_policy' && canAccessAdminTab(user, 'safety_policy') && <SecurityPolicyTab />}
      {tab==='safety_logs' && canAccessAdminTab(user, 'safety_logs') && <AdminLogs />}

      {tab==='billing_overview' && canAccessAdminTab(user, 'billing_overview') && (
        <RoleOverviewPanel
          title="Биллинг"
          subtitle="Premium-заявки, оплаты, выручка и контроль коммерческих операций."
          accent="linear-gradient(135deg, rgba(52,211,153,0.18), rgba(16,185,129,0.14))"
          bullets={[
            'Обрабатывайте заявки на Premium и проверяйте спорные случаи.',
            'Следите за платежами и revenue-аналитикой.',
            'Контролируйте корректность выдачи доступа и тарифов.',
          ]}
          actions={[
            { label: 'Открыть Premium', tab: 'billing_apps' },
            { label: 'Открыть аналитику', tab: 'billing_analytics' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='billing_apps' && canAccessAdminTab(user, 'billing_apps') && <PremiumApplicationsTab />}
      {tab==='billing_analytics' && canAccessAdminTab(user, 'billing_analytics') && <AnalyticsReportsTab />}

      {tab==='release_overview' && canAccessAdminTab(user, 'release_overview') && (
        <RoleOverviewPanel
          title="Релизы и коммуникации"
          subtitle="Рассылки, системные баннеры, письма, техработы и внешние коммуникации."
          accent="linear-gradient(135deg, rgba(96,165,250,0.18), rgba(124,108,255,0.14))"
          bullets={[
            'Управляйте анонсами, баннерами и системными письмами.',
            'Готовьте тексты и публикации для важных изменений продукта.',
            'Поддерживайте понятную коммуникацию во время техработ.',
          ]}
          actions={[
            { label: 'Открыть письма и баннеры', tab: 'release_messages' },
            { label: 'Открыть техработы', tab: 'release_maintenance' },
            { label: 'Открыть коммуникации', tab: 'release_communication' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='release_messages' && canAccessAdminTab(user, 'release_messages') && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <AdminMessaging />
          <BroadcastManager />
        </div>
      )}
      {tab==='release_maintenance' && canAccessAdminTab(user, 'release_maintenance') && <MaintenanceManager />}
      {tab==='release_communication' && canAccessAdminTab(user, 'release_communication') && <CommunicationTab />}

      {tab==='sysadmin_overview' && canAccessAdminTab(user, 'sysadmin_overview') && (
        <RoleOverviewPanel
          title="Тех. администрирование"
          subtitle="Инфраструктура, пользователи, сервисы, мониторинг, логи и техническая стабильность платформы."
          accent="linear-gradient(135deg, rgba(124,108,255,0.2), rgba(61,216,255,0.14))"
          bullets={[
            'Управляйте доступами, сервисами и критичными настройками системы.',
            'Следите за состоянием уведомлений, вебхуков и интеграций.',
            'Работайте с мониторингом, аудитом и живыми логами.',
          ]}
          actions={[
            { label: 'Открыть пользователей', tab: 'sysadmin_users' },
            { label: 'Открыть сервисы', tab: 'sysadmin_services' },
            { label: 'Открыть мониторинг', tab: 'sysadmin_monitor' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='sysadmin_users' && canAccessAdminTab(user, 'sysadmin_users') && <UsersTab currentUser={user} />}
      {tab==='sysadmin_support_chat' && canAccessAdminTab(user, 'sysadmin_support_chat') && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <SupportTab />
          <AnonymousDMTab />
        </div>
      )}
      {tab==='sysadmin_services' && canAccessAdminTab(user, 'sysadmin_services') && <ServiceManager />}
      {tab==='sysadmin_monitor' && canAccessAdminTab(user, 'sysadmin_monitor') && <SystemMonitor />}
      {tab==='sysadmin_webhook' && canAccessAdminTab(user, 'sysadmin_webhook') && <WebhookManager />}
      {tab==='sysadmin_push' && canAccessAdminTab(user, 'sysadmin_push') && <PushTab />}
      {tab==='sysadmin_audit' && canAccessAdminTab(user, 'sysadmin_audit') && <AuditLogTab />}
      {tab==='sysadmin_integrations' && canAccessAdminTab(user, 'sysadmin_integrations') && <SystemIntegrationsTab />}
      {tab==='sysadmin_analytics' && canAccessAdminTab(user, 'sysadmin_analytics') && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <StatsTab />
          <AnalyticsDashboard />
        </div>
      )}

      {tab==='owner_overview' && canAccessAdminTab(user, 'owner_overview') && (
        <RoleOverviewPanel
          title="Владелец"
          subtitle="Максимальный доступ ко всей системе: sovereign-панель, критические сервисы, база данных и глобальные настройки."
          accent="linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.14))"
          bullets={[
            'Смотрите все административные зоны без ограничений по ролям.',
            'Управляйте критическими настройками, ролями и коммерцией.',
            'Используйте опасные операции только при полной уверенности в последствиях.',
          ]}
          actions={[
            { label: 'Открыть sovereign-панель', tab: 'sovereign' },
            { label: 'Открыть сервисы', tab: 'services' },
            { label: 'Открыть базу данных', tab: 'database' },
          ]}
          onOpenTab={setTab}
        />
      )}
      {tab==='sovereign' && canAccessAdminTab(user, 'sovereign') && <OwnerTab currentUser={user} />}
      {tab==='services' && canAccessAdminTab(user, 'services') && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <ServiceManager />
          <SystemMonitor />
          <LiveLogs />
        </div>
      )}
      {tab==='database' && canAccessAdminTab(user, 'database') && <DatabaseTab currentUser={user} />}
        </div>
      </main>
    </div>
  );
}

function RoleOverviewPanel({
  title,
  subtitle,
  accent,
  bullets,
  actions,
  onOpenTab,
}: {
  title: string;
  subtitle: string;
  accent: string;
  bullets: string[];
  actions: Array<{ label: string; tab: AdminTabId }>;
  onOpenTab: (tab: AdminTabId) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section
        style={{
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: accent,
          boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
        }}
      >
        <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.72)', marginBottom: '10px' }}>
          Рабочая зона роли
        </div>
        <h2 style={{ margin: 0, fontSize: '28px', lineHeight: 1.15, color: '#fff' }}>{title}</h2>
        <p style={{ margin: '14px 0 0', maxWidth: '760px', color: 'rgba(255,255,255,0.84)', lineHeight: 1.6 }}>{subtitle}</p>
      </section>

      <section style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 0.7fr)' }}>
        <div style={{ padding: '22px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '14px', color: 'var(--fg)' }}>Зона ответственности</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {bullets.map((bullet) => (
              <div key={bullet} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: 'var(--fg)' }}>
                <span style={{ color: 'var(--accent, #7c6cff)', marginTop: '2px' }}>●</span>
                <span style={{ color: 'var(--subtle, #cbd5e1)', lineHeight: 1.55 }}>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '22px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '14px', color: 'var(--fg)' }}>Быстрые действия</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {actions.map((action) => (
              <button
                key={action.tab}
                type="button"
                onClick={() => onOpenTab(action.tab)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--fg)',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function OwnerTab({ currentUser }: { currentUser: any }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dashboardData, settingsData, revenueData] = await Promise.all([
        api('/api/owner/dashboard'),
        api('/api/owner/settings'),
        api('/api/owner/revenue').catch(() => null),
      ]);
      setDashboard(dashboardData);
      setSettings(settingsData);
      setRevenue(revenueData);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось загрузить панель владельца.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getRoleLevel(currentUser) < ROLE_LEVEL.owner) {
      setLoading(false);
      return;
    }
    loadAll();
  }, [currentUser]);

  const saveSettings = async (updates: Record<string, any>) => {
    try {
      const next = { ...(settings || {}), ...updates };
      await api('/api/owner/settings', 'POST', next);
      setSettings(next);
      showToast('Настройки сохранены', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось сохранить настройки.'), 'error');
    }
  };

  if (getRoleLevel(currentUser) < ROLE_LEVEL.owner) {
    return <div className="empty" style={{ padding: '48px' }}>Недостаточно прав доступа.</div>;
  }

  if (loading) {
    return <div className="empty" style={{ padding: '48px' }}>Загрузка...</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--fg)' }}>Панель владельца</h3>
          <p style={{ margin: '6px 0 0', color: 'var(--subtle)' }}>Критичные метрики проекта и глобальные настройки в одном месте.</p>
        </div>
        <button onClick={loadAll} style={{ padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
          Обновить
        </button>
      </div>

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <MetricCard label="Пользователи" value={dashboard?.users?.total || 0} />
        <MetricCard label="Premium" value={dashboard?.users?.premium || 0} highlight="#fbbf24" />
        <MetricCard label="Чаты" value={dashboard?.chats?.total || 0} />
        <MetricCard label="Сообщения" value={dashboard?.messages?.total || 0} />
        <MetricCard label="Серверы" value={dashboard?.servers?.total || 0} />
        {revenue && <MetricCard label="Выручка, 30 дней" value={`${Math.round((revenue.last30DaysRevenue || 0) / 100)} ₽`} highlight="#6ee7b7" />}
      </div>

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)' }}>
        <section style={{ padding: '20px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ marginTop: 0, color: 'var(--fg)' }}>Новые пользователи</h4>
          <div style={{ display: 'grid', gap: '10px' }}>
            {(dashboard?.users?.recent || []).map((item: any) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
                <div>
                  <div style={{ color: 'var(--fg)', fontWeight: 600 }}>{item.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--subtle)' }}>{item.email || 'Без email'}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--subtle)', textTransform: 'uppercase' }}>{item.plan || 'free'}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '20px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ marginTop: 0, color: 'var(--fg)' }}>Системные настройки</h4>
          <div style={{ display: 'grid', gap: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', color: 'var(--fg)' }}>
              <span>Техработы</span>
              <input type="checkbox" checked={Boolean(settings?.maintenance)} onChange={(e) => saveSettings({ maintenance: e.target.checked })} />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', color: 'var(--fg)' }}>
              <span>Регистрация открыта</span>
              <input type="checkbox" checked={settings?.registrationEnabled !== false} onChange={(e) => saveSettings({ registrationEnabled: e.target.checked })} />
            </label>
            <div style={{ color: 'var(--subtle)', fontSize: '13px', lineHeight: 1.5 }}>
              <div>Максимальный размер файла: {settings?.maxFileSize ? `${Math.round(settings.maxFileSize / 1024 / 1024)} MB` : 'не задан'}</div>
              <div>Базовая цена Premium: {settings?.premiumPrice || 0} ₽</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string | number; highlight?: string }) {
  return (
    <div style={{ padding: '18px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '28px', fontWeight: 700, color: highlight || 'var(--fg)' }}>{value}</div>
      <div style={{ marginTop: '8px', color: 'var(--subtle)', fontSize: '13px' }}>{label}</div>
    </div>
  );
}

function DatabaseTab({ currentUser }: { currentUser: any }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { plan: string; roles: string }>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; username: string } | null>(null);
  const [clearDbConfirm, setClearDbConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const roleOptions = getStaffRoleOptions().map((option) => option.value).join(', ');

  const load = async () => {
    try {
      setLoading(true);
      const data = await api('/api/admin/users');
      setList(data.users || []);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось загрузить пользователей.'), 'error');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getEdit = (u: any) => editing[u.id] ?? {
    plan: u.plan || 'free',
    roles: Array.isArray(u.roles) ? u.roles.join(', ') : (u.roles || ''),
  };

  const setEdit = (id: string, field: 'plan' | 'roles', value: string) => {
    setEditing((prev) => {
      const original = list.find((item) => item.id === id);
      const current = prev[id] ?? {
        plan: original?.plan || 'free',
        roles: Array.isArray(original?.roles) ? original.roles.join(', ') : (original?.roles || ''),
      };
      return { ...prev, [id]: { ...current, [field]: value } };
    });
  };

  const saveUser = async (u: any) => {
    const ed = getEdit(u);
    try {
      await api(`/api/owner/users/${u.id}/plan`, 'POST', { plan: ed.plan });
      const roles = ed.roles.split(',').map((r: string) => r.trim()).filter(Boolean);
      await api(`/api/owner/users/${u.id}/role`, 'POST', { roles: roles.length ? roles : ['user'] });
      showToast('Изменения сохранены', 'success');
      setEditing((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось сохранить изменения.'), 'error');
    }
  };

  const deleteUser = async () => {
    if (!deleteConfirm) return;
    try {
      await api(`/api/owner/users/${deleteConfirm.id}`, 'DELETE');
      showToast('Пользователь удалён', 'success');
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось удалить пользователя.'), 'error');
    }
  };

  const clearDatabase = async () => {
    setClearing(true);
    try {
      await api('/api/owner/database/clear', 'POST');
      showToast('База данных очищена. Текущая сессия будет завершена.', 'success');
      setClearDbConfirm(false);
      localStorage.removeItem('token');
      window.location.href = '/';
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось очистить базу данных.'), 'error');
    } finally {
      setClearing(false);
    }
  };

  if (loading) return <div className="empty" style={{ padding: '48px' }}>Загрузка...</div>;

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div>
        <h3 style={{ margin: 0, color: 'var(--fg)' }}>База данных и служебные аккаунты</h3>
        <p style={{ color: 'var(--subtle)', marginTop: '8px' }}>
          Здесь можно менять тарифы, роли и при необходимости удалять пользователей.
        </p>
      </div>

      <div style={{ color: 'var(--subtle)', fontSize: '13px' }}>
        Доступные роли: {roleOptions}. Если поле роли оставить пустым, пользователю будет назначена роль <code>user</code>.
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={load} style={{ padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
          Обновить
        </button>
        <button onClick={() => setClearDbConfirm(true)} style={{ padding: '10px 16px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
          Очистить всю БД
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Username</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>План</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Роли</th>
              <th style={{ padding: '12px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const rolesArr = u.roles ? (Array.isArray(u.roles) ? u.roles : String(u.roles).split(',').map((r: string) => r.trim())) : [];
              const isOwnerUser = rolesArr.includes('owner');
              const ed = getEdit(u);
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}>{u.username}</td>
                  <td style={{ padding: '12px' }}>{u.email || '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <select
                      value={ed.plan}
                      onChange={(e) => setEdit(u.id, 'plan', e.target.value)}
                      disabled={isOwnerUser && isSystemOwner(u)}
                      style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', minWidth: '110px' }}
                    >
                      <option value="free">free</option>
                      <option value="premium">premium</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      value={ed.roles}
                      onChange={(e) => setEdit(u.id, 'roles', e.target.value)}
                      disabled={isOwnerUser && isSystemOwner(u)}
                      placeholder={roleOptions}
                      style={{ width: '100%', maxWidth: '320px', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                    />
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => saveUser(u)} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      Сохранить
                    </button>
                    {!isSelf && !isOwnerUser && (
                      <button onClick={() => setDeleteConfirm({ id: u.id, username: u.username })} style={{ padding: '6px 12px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={deleteUser}
          title="Удаление пользователя"
          message={`Подтвердите удаление пользователя "${deleteConfirm.username}"?`}
          confirmText="Удалить"
          cancelText="Отмена"
          danger
        />
      )}

      {clearDbConfirm && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setClearDbConfirm(false)}
          onConfirm={clearDatabase}
          title="Очистка всей базы"
          message="Будут удалены пользователи, чаты, сообщения и остальные данные проекта без возможности восстановления."
          confirmText={clearing ? 'Очистка...' : 'Очистить БД'}
          cancelText="Отмена"
          danger
        />
      )}
    </div>
  );
}

function UsersTab({ currentUser }: { currentUser: any }) {
  const [list, setList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showUserIds, setShowUserIds] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{open: boolean, action: string, userId: string, username: string}>({
    open: false,
    action: '',
    userId: '',
    username: ''
  });
  const roleFilterOptions = getStaffRoleOptions();
  const roleIconMap: Record<string, string> = {
    owner: '??',
    sysadmin: '??',
    release_manager: '??',
    billing_manager: '??',
    safety: '??',
    risk_analyst: '??',
    moderator: '???',
    support_lead: '??',
    support_l1: '??',
    user: '??',
  };

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterPlan !== 'all') params.set('plan', filterPlan);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const data = await api('/api/admin/users' + (params.toString() ? '?' + params : ''));
      setList(data.users || []);
      setFilteredList(data.users || []);
    } catch (e: any) {
      console.error('Failed to load users:', e);
      showToast(getErrorMessage(e, 'Не удалось загрузить данные.'), 'error');
      setList([]);
      setFilteredList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterPlan]);

  useEffect(() => {
    if (historyUserId) {
      api('/api/admin/users/' + historyUserId + '/history').then((d) => setHistoryList(d?.history || [])).catch(() => setHistoryList([]));
    }
  }, [historyUserId]);

  useEffect(() => {
    if (recoveryUserId) {
      api('/api/admin/users/' + recoveryUserId + '/recovery-codes').then((d) => setRecoveryCodes(d?.codes || [])).catch(() => setRecoveryCodes([]));
    }
  }, [recoveryUserId]);

  const bulkAction = async (action: string, value?: string) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await api('/api/admin/users/bulk', 'POST', { userIds: Array.from(selectedIds), action, value: value || '' });
      showToast('Выполнено для ' + selectedIds.size + ' польз.', 'success');
      setSelectedIds(new Set());
      load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const resetRecoveryCodes = async () => {
    if (!recoveryUserId) return;
    try {
      const d = await api('/api/admin/users/' + recoveryUserId + '/recovery-codes/reset', 'POST', {});
      setRecoveryCodes(d?.codes || []);
      showToast('Новые коды сгенерированы', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredList.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredList.map((u: any) => u.id)));
  };

  const getStatusLabel = (status: string) => {
    if (status === 'banned') return '🚫 Заблокирован';
    if (status === 'suspended') return '⏸ Временно приостановлен';
    if (status === 'online') return '🟢 Онлайн';
    if (status === 'offline') return '⚫ Оффлайн';
    if (status === 'away') return '🌙 Отошёл';
    if (status === 'busy') return '⛔ Занят';
    if (status === 'invisible') return '👁️ Невидимка';
    return status || 'online';
  };

  useEffect(() => {
    let filtered = list;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(u =>
        (u.username && u.username.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.id && (u.id.toLowerCase().includes(query) || u.id === query))
      );
    }
    
    if (filterRole !== 'all') {
      filtered = filtered.filter((u) => getPrimaryRoleName(u) === filterRole);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => {
        if (filterStatus === 'banned') return u.status === 'banned';
        if (filterStatus === 'suspended') return u.status === 'suspended';
        if (filterStatus === 'online') return u.status === 'online';
        return true;
      });
    }
    
    setFilteredList(filtered);
  }, [list, searchQuery, filterRole, filterStatus]);
  
  const blockUser = async (id: string, username: string) => {
    setConfirmModal({ open: true, action: 'block', userId: id, username });
  };
  
  const unblockUser = async (id: string) => {
    try {
      await api(`/api/admin/users/${id}/unblock`, 'POST');
      showToast('Пользователь разблокирован', 'success');
      await load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };

  const suspendUser = async (id: string, username: string) => {
    setConfirmModal({ open: true, action: 'suspend', userId: id, username });
  };

  const unsuspendUser = async (id: string) => {
    try {
      await api(`/api/admin/users/${id}/unsuspend`, 'POST');
      showToast('Приостановка снята', 'success');
      await load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };
  
  const promoteUser = async (id: string, username: string) => {
    setConfirmModal({ open: true, action: 'promote', userId: id, username });
  };
  
  const demoteUser = async (id: string, username: string) => {
    setConfirmModal({ open: true, action: 'demote', userId: id, username });
  };

  const deleteUserOwner = async (id: string, username: string) => {
    setConfirmModal({ open: true, action: 'delete', userId: id, username });
  };

  const handleConfirm = async () => {
    const { action, userId } = confirmModal;
    try {
      if (action === 'block') {
        await api(`/api/admin/users/${userId}/block`, 'POST');
        showToast('Пользователь заблокирован', 'success');
      } else if (action === 'suspend') {
        await api(`/api/admin/users/${userId}/suspend`, 'POST');
        showToast('Аккаунт временно приостановлен', 'success');
      } else if (action === 'promote') {
        await api(`/api/admin/users/${userId}/promote`, 'POST');
        showToast('Права администратора предоставлены', 'success');
      } else if (action === 'demote') {
        await api(`/api/admin/users/${userId}/demote`, 'POST');
        showToast('Права администратора сняты', 'success');
      } else if (action === 'delete') {
        await api(`/api/owner/users/${userId}`, 'DELETE');
        showToast('Аккаунт удалён', 'success');
      }
      await load();
      setConfirmModal({ open: false, action: '', userId: '', username: '' });
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };
  
  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }
  
  return (
    <div>
      <div style={{
        marginBottom: '24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{fontSize: '18px', fontWeight: '600'}}>
          Всего пользователей: {list.length} {filteredList.length !== list.length && `(отфильтровано: ${filteredList.length})`}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input type="checkbox" checked={showUserIds} onChange={e => setShowUserIds(e.target.checked)} />
            Показать ID
          </label>
          <button onClick={async () => { try { const base = getApiBaseUrl(); const token = localStorage.getItem('token'); const url = base + '/api/admin/users/export' + (filterPlan !== 'all' ? '?plan=' + filterPlan : ''); const r = await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} }); const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'users.csv'; a.click(); URL.revokeObjectURL(a.href); showToast('Файл сохранён', 'success'); } catch (e: any) { showToast(getErrorMessage(e, 'Не удалось экспортировать.'), 'error'); } }} style={{ padding: '10px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontWeight: '500' }}>Экспорт CSV</button>
          <button onClick={load} style={{ padding: '10px 16px', background: 'var(--accent, #3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>🔄 Обновить</button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '600' }}>Выбрано: {selectedIds.size}</span>
          <button onClick={() => bulkAction('block')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Заблокировать</button>
          <button onClick={() => bulkAction('unblock')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Разблокировать</button>
          <button onClick={() => bulkAction('suspend')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Приостановить</button>
          <button onClick={() => bulkAction('unsuspend')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Снять приостановку</button>
          <button onClick={() => bulkAction('promote')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Сделать админом</button>
          <button onClick={() => bulkAction('demote')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>Снять админа</button>
          <button onClick={() => bulkAction('set_plan', 'premium')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>План Premium</button>
          <button onClick={() => setSelectedIds(new Set())} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>Снять выбор</button>
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="Поиск по имени, email или ID..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '10px 12px',
            background: 'var(--panel-2, #111827)',
            border: '1px solid var(--border, #374151)',
            borderRadius: '8px',
            color: 'var(--fg, #e5e7eb)'
          }}
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          style={{
            padding: '10px 12px',
            background: 'var(--panel-2, #111827)',
            border: '1px solid var(--border, #374151)',
            borderRadius: '8px',
            color: 'var(--fg, #e5e7eb)',
            cursor: 'pointer'
          }}
        >
          <option value="all">Все роли</option>
          {roleFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {(roleIconMap[option.value] || '👤') + ' ' + option.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            padding: '10px 12px',
            background: 'var(--panel-2, #111827)',
            border: '1px solid var(--border, #374151)',
            borderRadius: '8px',
            color: 'var(--fg, #e5e7eb)',
            cursor: 'pointer'
          }}
        >
          <option value="all">Все статусы</option>
          <option value="online">🟢 Онлайн</option>
          <option value="suspended">⏸ Приостановленные</option>
          <option value="banned">🚫 Заблокированные</option>
        </select>
        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          style={{
            padding: '10px 12px',
            background: 'var(--panel-2, #111827)',
            border: '1px solid var(--border, #374151)',
            borderRadius: '8px',
            color: 'var(--fg, #e5e7eb)',
            cursor: 'pointer'
          }}
        >
          <option value="all">Все планы</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {filteredList.length === 0 ? (
        <div className="empty" style={{padding: '48px'}}>
          {list.length === 0 ? 'Нет пользователей' : 'Ничего не найдено'}
        </div>
      ) : (
        <>
        {canBlockUser(currentUser, { id: '', roles: [] }) && (
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedIds.size === filteredList.length} onChange={toggleSelectAll} />
              Выбрать всех (для массовых действий)
            </label>
          </div>
        )}
        <div style={{display: 'grid', gap: '12px'}}>
          {filteredList.map(u => {
            const primaryRole = getPrimaryRoleName(u);
            const roleLabel = getRoleLabel(u) || 'Пользователь';
            const normalizedRoles = getEffectiveRoles(u);
            const uIsOwner = primaryRole === 'owner';
            const uIsSysadmin = primaryRole === 'sysadmin';
            const uIsBanned = u.status === 'banned';
            const uIsSuspended = u.status === 'suspended';
            const systemOwner = isSystemOwner(u);
            const canBlock = canBlockUser(currentUser, u);
            const canDemote = canDemoteUser(currentUser, u);
            const canPromoteAdmin = canPromoteTo(currentUser, 'sysadmin');
            return (
              <div 
                key={u.id} 
                style={{
                  padding: '16px', 
                  background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                  border: '1px solid var(--border, #374151)', 
                  borderRadius: '12px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)';
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border, #374151)';
                  e.currentTarget.style.background = 'var(--panel, rgba(31, 41, 55, 0.6))';
                }}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px'}}>
                  <div style={{display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1}}>
                    {canBlock && (
                      <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} style={{ marginTop: '4px' }} />
                    )}
                    <div style={{flex: 1}}>
                    <div style={{fontWeight: '600', fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                      {u.username} 
                      {showUserIds && <code style={{ fontSize: '12px', background: 'var(--panel-2)', padding: '2px 8px', borderRadius: '6px', color: 'var(--subtle)', fontWeight: '400' }} title={u.id}>{u.id}</code>}
                      {systemOwner && <span title="Встроенный системный владелец" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>Системный владелец</span>}
                      {!systemOwner && <span title={roleLabel} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--fg)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>{(roleIconMap[primaryRole] || '👤') + ' ' + roleLabel}</span>}
                    </div>
                    <div className="small" style={{marginBottom: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                      <span>Роли: <strong>{normalizedRoles.join(', ') || 'user'}</strong></span>
                      <span>|</span>
                      <span>Статус: <strong>{getStatusLabel(u.status)}</strong></span>
                      {u.plan && <><span>|</span> <span>Тариф: <strong>{u.plan}</strong></span></>}
                    </div>
                    {u.email && (
                      <div className="small" style={{marginBottom: '4px'}}>
                        📧 Email: {u.email}
                      </div>
                    )}
                    <div className="small" style={{marginBottom: '4px'}}>
                      📅 Создан: {new Date(u.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {u.lastSeen && (
                      <div className="small">
                        👁️ Последний раз онлайн: {new Date(u.lastSeen).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </div>
                  </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(u.id); showToast('ID скопирован', 'success'); }} style={{ padding: '4px 10px', fontSize: '12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--fg)' }} title={u.id}>Копировать ID</button>
                  <button type="button" onClick={() => setHistoryUserId(u.id)} style={{ padding: '4px 10px', fontSize: '12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--fg)' }}>История</button>
                  <button type="button" onClick={() => setRecoveryUserId(u.id)} style={{ padding: '4px 10px', fontSize: '12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--fg)' }}>Коды</button>
                </div>
                </div>
                {!systemOwner && (canBlock || canDemote || canDeleteUser(currentUser, u)) && (
                  <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border, #374151)'}}>
                    {canDeleteUser(currentUser, u) && (
                      <button
                        onClick={() => deleteUserOwner(u.id, u.username)}
                        style={{
                          padding: '8px 16px', fontSize: '14px', background: '#b91c1c', color: '#fff',
                          border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'
                        }}
                      >
                        🗑 Удалить аккаунт
                      </button>
                    )}
                    {canBlock && (
                      uIsBanned ? (
                        <button 
                          onClick={()=>unblockUser(u.id)} 
                          style={{
                            padding: '8px 16px', 
                            fontSize: '14px',
                            background: '#22c55e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          ✅ Разблокировать
                        </button>
                      ) : (
                        <>
                          {uIsSuspended ? (
                            <button
                              onClick={() => unsuspendUser(u.id)}
                              style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                background: '#0ea5e9',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '500'
                              }}
                            >
                              ▶ Снять приостановку
                            </button>
                          ) : (
                            <button
                              onClick={() => suspendUser(u.id, u.username)}
                              style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                background: '#f59e0b',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '500'
                              }}
                            >
                              ⏸ Приостановить
                            </button>
                          )}
                          <button 
                            onClick={()=>blockUser(u.id, u.username)} 
                            style={{
                              padding: '8px 16px', 
                              fontSize: '14px', 
                              background: '#dc3545',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            🚫 Заблокировать
                          </button>
                        </>
                      )
                    )}
                    {!uIsSysadmin && !uIsOwner ? (
                      canPromoteAdmin && (
                        <button 
                          onClick={()=>promoteUser(u.id, u.username)} 
                          style={{
                            padding: '8px 16px', 
                            fontSize: '14px',
                            background: 'var(--accent, #3b82f6)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          ⚡ Сделать админом
                        </button>
                      )
                    ) : (uIsSysadmin || uIsOwner) && canDemote ? (
                      <button 
                        onClick={()=>demoteUser(u.id, u.username)} 
                        style={{
                          padding: '8px 16px', 
                          fontSize: '14px',
                          background: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        ⬇ Снять админа
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {historyUserId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setHistoryUserId(null)}>
          <div style={{ background: 'var(--panel)', borderRadius: 12, padding: 24, maxWidth: 520, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>История ролей и банов</h3>
            {historyList.length === 0 ? <div className="empty">Нет записей</div> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {historyList.map((h: any) => (
                  <div key={h.id} style={{ padding: 10, background: 'var(--panel-2)', borderRadius: 8, fontSize: 13 }}>
                    <strong>{h.action}</strong> · {h.oldValue} → {h.newValue} · {new Date(h.createdAt).toLocaleString('ru-RU')}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setHistoryUserId(null)} style={{ marginTop: 16, padding: '8px 16px', background: 'var(--border)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Закрыть</button>
          </div>
        </div>
      )}

      {recoveryUserId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setRecoveryUserId(null)}>
          <div style={{ background: 'var(--panel)', borderRadius: 12, padding: 24, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Резервные коды доступа</h3>
            {recoveryCodes.length === 0 ? <div className="empty">Нет кодов или ошибка загрузки</div> : (
              <div style={{ marginBottom: 16 }}>
                {recoveryCodes.map((c, i) => <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>{c}</div>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resetRecoveryCodes} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Сгенерировать новые</button>
              <button onClick={() => setRecoveryUserId(null)} style={{ padding: '8px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, action: '', userId: '', username: '' })}
        onConfirm={handleConfirm}
        title={
          confirmModal.action === 'block' ? 'Заблокировать пользователя' :
          confirmModal.action === 'suspend' ? 'Временно приостановить аккаунт' :
          confirmModal.action === 'promote' ? 'Назначить администратором' :
          confirmModal.action === 'demote' ? 'Снять права администратора' :
          confirmModal.action === 'delete' ? 'Удалить аккаунт' : 'Подтверждение'
        }
        message={
          confirmModal.action === 'block' ? `Вы уверены, что хотите заблокировать пользователя "${confirmModal.username}"?` :
          confirmModal.action === 'suspend' ? `Временно приостановить аккаунт "${confirmModal.username}"? Пользователь не сможет войти, а письма и push-уведомления будут отключены.` :
          confirmModal.action === 'promote' ? `Назначить пользователя "${confirmModal.username}" администратором?` :
          confirmModal.action === 'demote' ? `Снять права администратора у пользователя "${confirmModal.username}"?` :
          confirmModal.action === 'delete' ? `Безвозвратно удалить аккаунт "${confirmModal.username}"? Данные пользователя будут удалены.` : 'Подтвердите действие'
        }
        confirmText="Подтвердить"
        cancelText="Отмена"
        danger={confirmModal.action === 'block' || confirmModal.action === 'suspend' || confirmModal.action === 'delete'}
      />
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      setLoading(true);
      const data = await api('/api/admin/stats');
      setStats(data.stats);
    } catch (e: any) {
      console.error('Failed to load stats:', e);
      showToast(getErrorMessage(e, 'Не удалось загрузить данные.'), 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); }, []);
  
  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="empty" style={{padding: '48px'}}>
        Нет данных
      </div>
    );
  }
  
  const statCards = [
    { label: 'Пользователей', value: stats.users || 0, icon: '👥', color: '#3b82f6' },
    { label: 'Чатов', value: stats.chats || 0, icon: '💬', color: '#10b981' },
    { label: 'Сообщений', value: stats.messages || 0, icon: '📨', color: '#8b5cf6' },
    { label: 'Онлайн', value: stats.online || 0, icon: '🟢', color: '#22c55e' },
    { label: 'Серверов', value: stats.servers || 0, icon: '🖥️', color: '#f59e0b' },
    { label: 'Каналов', value: stats.channels || 0, icon: '📢', color: '#ef4444' },
    { label: 'Групп', value: stats.groups || 0, icon: '👥', color: '#06b6d4' }
  ];
  
  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <h3 style={{fontSize: '20px', fontWeight: '600'}}>Статистика системы</h3>
        <button 
          onClick={load}
          style={{
            padding: '10px 16px',
            background: 'var(--accent, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🔄 Обновить
        </button>
      </div>
      <div style={{
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
        gap: '16px'
      }}>
        {statCards.map((stat, idx) => (
          <div 
            key={idx}
            style={{
              padding: '20px', 
              background: 'var(--panel, rgba(31, 41, 55, 0.6))', 
              borderRadius: '12px', 
              border: '1px solid var(--border, #374151)',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              fontSize: '32px', 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: stat.color,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{stat.icon}</span>
              <span>{stat.value}</span>
            </div>
            <div className="small" style={{fontSize: '14px', color: 'var(--subtle, #9ca3af)'}}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModTab() {
  const [queue, setQueue] = useState<any[]>([]);
  const load = ()=> api('/api/admin/modqueue').then(setQueue).catch(()=>setQueue([]));
  useEffect(()=>{ load(); }, []);
  const approve = async (id:string)=>{ await api('/api/admin/approve/'+id,'POST'); load(); };
  return <div>
    {queue.length===0 ? <div className="small">Очередь пуста</div> : queue.map(c=>(
      <div key={c.id} className="list-item">
        <div>{c.title || '(без названия)'} — {c.id}</div>
        <button onClick={()=>approve(c.id)}>Одобрить</button>
      </div>
    ))}
  </div>;
}

function ReportsTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/api/admin/reports')
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }
  
  return (
    <div>
      <div style={{marginBottom: '24px'}}>
        <h3 style={{fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}>Жалобы пользователей</h3>
        <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
          Всего жалоб: {list.length}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty" style={{padding: '48px'}}>
          Нет жалоб
        </div>
      ) : (
        <div style={{display: 'grid', gap: '12px'}}>
          {list.map(r => (
            <div 
              key={r.id}
              style={{
                padding: '16px',
                background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                border: '1px solid var(--border, #374151)',
                borderRadius: '12px'
              }}
            >
              <div style={{fontWeight: '600', marginBottom: '8px'}}>
                Сообщение ID: {r.messageId || r.id}
              </div>
              <div className="small" style={{marginBottom: '4px'}}>
                Причина: {r.reason || 'Не указана'}
              </div>
              {r.userId && (
                <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
                  От пользователя: {r.userId}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PremiumApplicationsTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/api/admin/feedback')
      .then((response: any) => Array.isArray(response?.tickets) ? response.tickets : [])
      .then((all: any[]) => all.filter((f: any) => f.category === 'premium' || (f.subject || '').includes('Заявка на тариф')))
      .catch(() => [])
      .then(setList)
      .finally(() => setLoading(false));
  }, []);
  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }
  const exportPremiumCsv = () => {
    const headers = ['id', 'subject', 'body', 'userId', 'createdAt'];
    const rows = list.map((f: any) => [f.id ?? '', (f.subject ?? '').replace(/"/g, '""'), (f.body ?? '').replace(/"/g, '""'), f.userId ?? '', f.createdAt ? new Date(f.createdAt).toISOString() : '']);
    const csv = [headers.join(','), ...rows.map((r: string[]) => r.map(x => `"${String(x)}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `premium_applications_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    showToast('CSV сохранён', 'success');
  };

  return (
    <div>
      <div style={{marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          <h3 style={{fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}>Заявки на Premium / Enterprise</h3>
          <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
            Рассмотрите заявки и выдайте тариф во вкладке «Пользователи» (план Premium). Всего: {list.length}
          </div>
        </div>
        {list.length > 0 && (
          <button type="button" onClick={exportPremiumCsv} style={{padding: '8px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontWeight: '500'}}>Экспорт CSV</button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="empty" style={{padding: '48px'}}>
          Нет заявок на тариф
        </div>
      ) : (
        <div style={{display: 'grid', gap: '12px'}}>
          {list.map((f: any) => (
            <div
              key={f.id}
              style={{
                padding: '16px',
                background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                border: '1px solid var(--border, #374151)',
                borderRadius: '12px'
              }}
            >
              <div style={{fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: 'var(--accent, #3b82f6)'}}>
                {f.subject || 'Без темы'}
              </div>
              <div style={{marginBottom: '12px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                {f.body || 'Нет содержимого'}
              </div>
              {f.userId && (
                <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
                  ID пользователя: {f.userId} — выдать Premium во вкладке «Пользователи»
                </div>
              )}
              {f.createdAt && (
                <div className="small" style={{color: 'var(--subtle, #9ca3af)', marginTop: '4px'}}>
                  {new Date(f.createdAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecruitTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actioning, setActioning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const load = () => {
    setLoading(true);
    api('/api/admin/recruit')
      .then((r: any) => (Array.isArray(r) ? r : []))
      .catch(() => [])
      .then(setList)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onApprove = async (id: string) => {
    try {
      setActioning(true);
      await api(`/api/admin/recruit/${id}/approve`, 'POST');
      showToast('Заявка принята, письмо отправлено', 'success');
      load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Ошибка'), 'error');
    } finally {
      setActioning(false);
    }
  };

  const onDeclineOpen = (id: string) => {
    setDeclineId(id);
    setDeclineReason('');
  };

  const onDeclineSubmit = async () => {
    if (!declineId || !declineReason.trim()) {
      showToast('Укажите причину отклонения', 'error');
      return;
    }
    try {
      setActioning(true);
      await api(`/api/admin/recruit/${declineId}/decline`, 'POST', { reason: declineReason.trim() });
      showToast('Заявка отклонена, письмо отправлено', 'success');
      setDeclineId(null);
      setDeclineReason('');
      load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Ошибка'), 'error');
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }
  const filteredRecruit = filterStatus === 'all' ? list : list.filter((a: any) => a.status === filterStatus);

  const exportRecruitCsv = () => {
    const headers = ['id', 'name', 'email', 'role', 'status', 'message', 'declineReason', 'createdAt'];
    const rows = filteredRecruit.map((a: any) => [a.id, a.name ?? '', a.email ?? '', a.role ?? '', a.status ?? '', (a.message ?? '').replace(/"/g, '""'), (a.declineReason ?? '').replace(/"/g, '""'), a.createdAt ? new Date(a.createdAt).toISOString() : '']);
    const csv = [headers.join(','), ...rows.map((r: string[]) => r.map(x => `"${x}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `recruit_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    showToast('CSV сохранён', 'success');
  };

  return (
    <div>
      <div style={{marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          <h3 style={{fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}>Набор: тестировщики и хелперы</h3>
          <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
            Заявки с публичной страницы <a href="/join" target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)'}}>/join</a>. Всего: {list.length} {filteredRecruit.length !== list.length && `(отфильтровано: ${filteredRecruit.length})`}
          </div>
        </div>
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{padding: '8px 12px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer'}}>
            <option value="all">Все</option>
            <option value="pending">Ожидают</option>
            <option value="approved">Приняты</option>
            <option value="declined">Отклонены</option>
          </select>
          <button type="button" onClick={exportRecruitCsv} style={{padding: '8px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontWeight: '500'}}>Экспорт CSV</button>
        </div>
      </div>
      {filteredRecruit.length === 0 ? (
        <div className="empty" style={{padding: '48px'}}>Нет заявок</div>
      ) : (
        <div style={{display: 'grid', gap: '12px'}}>
          {filteredRecruit.map((a: any) => (
            <div key={a.id} style={{padding: '16px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap'}}>
                <span style={{fontWeight: '600'}}>{a.name || '—'}</span>
                <span className="small" style={{color: 'var(--subtle)'}}>{a.email}</span>
                <span style={{fontSize: '12px', padding: '2px 8px', background: 'var(--accent)', borderRadius: 6}}>{a.role === 'helper' ? 'Хелпер' : 'Тестировщик'}</span>
                {a.status === 'approved' && <span style={{fontSize: '12px', padding: '2px 8px', background: '#22c55e', borderRadius: 6}}>Принят</span>}
                {a.status === 'declined' && <span style={{fontSize: '12px', padding: '2px 8px', background: '#ef4444', borderRadius: 6}}>Отклонён</span>}
              </div>
              {a.message && <div style={{marginBottom: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{a.message}</div>}
              {a.status === 'declined' && a.declineReason && <div style={{marginBottom: '8px', color: 'var(--subtle)', fontSize: '13px'}}>Причина: {a.declineReason}</div>}
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8}}>
                <div className="small" style={{color: 'var(--subtle)'}}>{a.createdAt ? new Date(a.createdAt).toLocaleString('ru-RU') : ''}</div>
                {a.status === 'pending' && (
                  <div style={{display: 'flex', gap: 8}}>
                    <button onClick={() => onApprove(a.id)} disabled={actioning} style={{padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: actioning ? 'not-allowed' : 'pointer', fontWeight: '500'}}>Принять</button>
                    <button onClick={() => onDeclineOpen(a.id)} disabled={actioning} style={{padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: actioning ? 'not-allowed' : 'pointer', fontWeight: '500'}}>Отклонить</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {declineId && (
        <div className="modal-overlay" style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999}} onClick={() => !actioning && setDeclineId(null)}>
          <div style={{background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%'}} onClick={e => e.stopPropagation()}>
            <h4 style={{marginBottom: 16}}>Причина отклонения</h4>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="Укажите причину (будет отправлена заявителю на почту)" rows={4} style={{width: '100%', padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', resize: 'vertical', marginBottom: 16}} />
            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
              <button onClick={() => setDeclineId(null)} disabled={actioning} style={{padding: '8px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--fg)'}}>Отмена</button>
              <button onClick={onDeclineSubmit} disabled={actioning || !declineReason.trim()} style={{padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: actioning ? 'not-allowed' : 'pointer'}}>Отклонить и отправить письмо</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/api/admin/feedback')
      .then((response: any) => setList(Array.isArray(response?.tickets) ? response.tickets : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }
  
  return (
    <div>
      <div style={{marginBottom: '24px'}}>
        <h3 style={{fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}>Обратная связь</h3>
        <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
          Всего сообщений: {list.length}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty" style={{padding: '48px'}}>
          Нет сообщений обратной связи
        </div>
      ) : (
        <div style={{display: 'grid', gap: '12px'}}>
          {list.map(f => (
            <div 
              key={f.id}
              style={{
                padding: '16px',
                background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                border: '1px solid var(--border, #374151)',
                borderRadius: '12px'
              }}
            >
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '12px',
                color: 'var(--accent, #3b82f6)'
              }}>
                {f.subject || 'Без темы'}
              </div>
              <div style={{
                marginBottom: '12px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {f.body || 'Нет содержимого'}
              </div>
              {f.userId && (
                <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
                  От пользователя: {f.userId}
                </div>
              )}
              {f.createdAt && (
                <div className="small" style={{color: 'var(--subtle, #9ca3af)', marginTop: '4px'}}>
                  {new Date(f.createdAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PushTab() {
  const [sent, setSent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const send = async () => {
    try {
      setLoading(true);
      const r = await api('/api/push/test', 'POST', {});
      setSent(r);
      showToast(`Уведомление отправлено: ${r.sent || 0}`, 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{maxWidth: '600px'}}>
      <div style={{
        padding: '20px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        borderRadius: '12px',
        border: '1px solid var(--border, #374151)',
        marginBottom: '24px'
      }}>
        <h4 style={{marginBottom: '12px', fontSize: '18px', fontWeight: '600'}}>Тестовое push-уведомление</h4>
        <p className="small" style={{marginBottom: '20px', lineHeight: '1.6'}}>
          Отправляет тестовое push‑уведомление всем вашим подпискам (текущий пользователь).
        </p>
        <button 
          onClick={send}
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: loading ? '#6b7280' : 'var(--accent, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          {loading ? 'Отправка...' : '🔔 Отправить тест'}
        </button>
        {sent && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            color: '#86efac'
          }}>
            ✅ Отправлено: {sent.sent || 0} уведомлений
          </div>
        )}
      </div>
    </div>
  );
}


