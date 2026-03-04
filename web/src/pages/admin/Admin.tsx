
import React, { useEffect, useState } from 'react';
import { api, getApiBaseUrl, getErrorMessage } from '../../services/api';
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
import { ADMIN_TABS, ADMIN_SECTIONS, canAccessAdminTab, getRoleLabel, getRoleLevel, isSystemOwner, canBlockUser, canDemoteUser, canPromoteTo, canDeleteUser, ROLE_LEVEL } from '../../utils/roles';

type AdminTabId = typeof ADMIN_TABS[number]['id'];

export default function Admin() {
  const [tab, setTab] = useState<AdminTabId>('users');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const visibleTabs = React.useMemo(
    () => ADMIN_TABS.filter((t) => user && canAccessAdminTab(user, t.id)),
    [user]
  );

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);

  const loadUser = async () => {
    try {
      const u = await api('/api/users/me');
      setUser(u);
      const firstTab = ADMIN_TABS.find((t) => canAccessAdminTab(u, t.id));
      if (firstTab) setTab(firstTab.id);
    } catch (e) {
      console.error('Failed to load user:', e);
    }
  };

  const roleLabel = user ? getRoleLabel(user) : '';
  const roleBadgeStyle = roleLabel === 'Владелец'
    ? { background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.2))', border: '1px solid rgba(251,191,36,0.4)', color: '#fcd34d' }
    : roleLabel === 'Тех. Админ'
    ? { background: 'linear-gradient(135deg, rgba(124,108,255,0.2), rgba(61,216,255,0.15))', border: '1px solid rgba(124,108,255,0.35)', color: '#a5b4fc' }
    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--subtle, #9ca3af)' };

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
              {roleLabel === 'Владелец' && '👑 Владелец'}
              {roleLabel === 'Тех. Админ' && '⚙️ Тех. Админ'}
              {roleLabel === 'Служба безопасности' && '🛡️ Безопасность'}
              {roleLabel === 'Модератор' && '🛡️ Модератор'}
              {roleLabel === 'Техподдержка' && '🎫 Поддержка'}
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
      {tab==='sovereign' && canAccessAdminTab(user, 'sovereign') && <OwnerTab currentUser={user} />}
      {tab==='users' && canAccessAdminTab(user, 'users') && <UsersTab currentUser={user} />}
      {tab==='analytics' && canAccessAdminTab(user, 'analytics') && <AnalyticsDashboard />}
      {tab==='bans' && canAccessAdminTab(user, 'bans') && <BanMuteManager />}
      {tab==='maintenance' && canAccessAdminTab(user, 'maintenance') && <MaintenanceManager />}
      {tab==='broadcast' && canAccessAdminTab(user, 'broadcast') && <BroadcastManager />}
      {tab==='messages' && canAccessAdminTab(user, 'messages') && <AdminMessaging />}
      {tab==='anonymous_dm' && canAccessAdminTab(user, 'anonymous_dm') && <AnonymousDMTab />}
      {tab==='logs' && canAccessAdminTab(user, 'logs') && <AdminLogs />}
      {tab==='monitor' && canAccessAdminTab(user, 'monitor') && <SystemMonitor />}
      {tab==='security' && canAccessAdminTab(user, 'security') && <SecurityDashboard />}
      {tab==='mod' && canAccessAdminTab(user, 'mod') && <ModTab/>}
      {tab==='reports' && canAccessAdminTab(user, 'reports') && <ReportsTab/>}
      {tab==='feedback' && canAccessAdminTab(user, 'feedback') && <FeedbackTab/>}
      {tab==='recruit' && canAccessAdminTab(user, 'recruit') && <RecruitTab/>}
      {tab==='premium_apps' && canAccessAdminTab(user, 'premium_apps') && <PremiumApplicationsTab />}
      {tab==='push' && canAccessAdminTab(user, 'push') && <PushTab/>}
      {tab==='services' && canAccessAdminTab(user, 'services') && <ServiceManager />}
      {tab==='database' && canAccessAdminTab(user, 'database') && <DatabaseTab currentUser={user} />}
      {tab==='webhook' && canAccessAdminTab(user, 'webhook') && <WebhookManager />}
      {tab==='support' && canAccessAdminTab(user, 'support') && <SupportTab />}
      {tab==='audit' && canAccessAdminTab(user, 'audit') && <AuditLogTab />}
      {tab==='content_moderation' && canAccessAdminTab(user, 'content_moderation') && <ContentModerationTab />}
      {tab==='security_policy' && canAccessAdminTab(user, 'security_policy') && <SecurityPolicyTab />}
      {tab==='communication' && canAccessAdminTab(user, 'communication') && <CommunicationTab />}
      {tab==='system_integrations' && canAccessAdminTab(user, 'system_integrations') && <SystemIntegrationsTab />}
      {tab==='analytics_reports' && canAccessAdminTab(user, 'analytics_reports') && <AnalyticsReportsTab />}
        </div>
      </main>
    </div>
  );
}

function OwnerTab({ currentUser }: { currentUser: any }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const level = getRoleLevel(currentUser);
  const isOwner = level >= ROLE_LEVEL.owner && isSystemOwner(currentUser);
  const isSysadmin = level >= ROLE_LEVEL.sysadmin && !isOwner;
  const isGuardian = level >= ROLE_LEVEL.safety && level < ROLE_LEVEL.sysadmin;
  const isSupport = level >= ROLE_LEVEL.support && level < ROLE_LEVEL.moderator;

  useEffect(() => {
    if (isOwner || isSysadmin) {
      loadDashboard();
      loadSettings();
      if (isOwner) {
        api('/api/owner/revenue').then(setRevenue).catch(() => {});
      }
    } else {
      setLoading(false);
    }
  }, [isOwner, isSysadmin]);

  const loadDashboard = async () => {
    try {
      const data = await api('/api/owner/dashboard');
      setDashboard(data);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось загрузить данные.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await api('/api/owner/settings');
      setSettings(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const saveSettings = async (updates: any) => {
    try {
      const updated = { ...settings, ...updates };
      await api('/api/owner/settings', 'POST', updated);
      setSettings(updated);
      showToast('Настройки сохранены', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось сохранить.'), 'error');
    }
  };

  const setPlan = async (userId: string, plan: 'free' | 'premium') => {
    try {
      await api(`/api/owner/users/${userId}/plan`, 'POST', { plan });
      showToast(`План пользователя изменен на ${plan}`, 'success');
      loadDashboard();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    try {
      await api(`/api/owner/users/${userId}`, 'DELETE');
      showToast('Пользователь удален', 'success');
      loadDashboard();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };

  if (loading && (isOwner || isSysadmin)) {
    return <div>Загрузка...</div>;
  }

  // Support: только тикеты и базовое инфо
  if (isSupport) {
    return (
      <div>
        <h3 style={{ marginBottom: '16px' }}>🎫 Поддержка — тикеты и пользователи</h3>
        <p style={{ color: 'var(--subtle)', marginBottom: '16px' }}>Просмотр тикетов и базовая информация о пользователях.</p>
        <SupportTab />
      </div>
    );
  }

  // Guardian: мониторинг трафика и бан по IP
  if (isGuardian) {
    return (
      <div>
        <h3 style={{ marginBottom: '16px' }}>🛡️ Security — мониторинг и бан по IP</h3>
        <p style={{ color: 'var(--subtle)', marginBottom: '16px' }}>Мониторинг трафика и блокировка подозрительных IP.</p>
        <SecurityDashboard />
      </div>
    );
  }

  // Owner (Lev) или Sysadmin: полная панель (кнопки остановки сервера / БД только у Lev — бэкенд проверяет)
  return (
    <div>
      <h3 style={{ marginBottom: '16px' }}>👑 Sovereign Control Panel</h3>
      
      {/* Статистика */}
      {dashboard && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '16px',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{dashboard.users?.total || 0}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Всего пользователей</div>
          </div>
          <div style={{
            padding: '16px',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
              {dashboard.users?.premium || 0}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>Premium</div>
          </div>
          <div style={{
            padding: '16px',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{dashboard.chats?.total || 0}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Чатов</div>
          </div>
          <div style={{
            padding: '16px',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{dashboard.messages?.total || 0}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Сообщений</div>
          </div>
        </div>
      )}

      {/* Доходы и конверсия (только owner) */}
      {isOwner && revenue && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px' }}>💰 Доходы и конверсия</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{(revenue.totalRevenue / 100).toFixed(0)} ₽</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Всего доход</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{(revenue.last30DaysRevenue / 100).toFixed(0)} ₽</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>За 30 дней</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{Number(revenue.conversionRate || 0).toFixed(1)}%</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Free → Premium</div>
            </div>
          </div>
          {revenue.recentPayments?.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Последние платежи: {revenue.recentPayments.slice(0, 5).map((p: any) => `${p.provider} ${(p.amount / 100).toFixed(0)} ${p.currency}`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Управление пользователями */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px' }}>Управление пользователями</h4>
        {dashboard?.users?.recent && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {dashboard.users.recent.map((u: any) => (
              <div key={u.id} style={{
                padding: '12px',
                background: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{u.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {u.email} • План: {u.plan}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={u.plan}
                    onChange={(e) => setPlan(u.id, e.target.value as 'free' | 'premium')}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                  <button
                    onClick={() => deleteUser(u.id)}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--danger)',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Системные настройки */}
      {settings && (
        <div>
          <h4 style={{ marginBottom: '12px' }}>Системные настройки</h4>
          <div style={{
            padding: '16px',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.maintenance || false}
                  onChange={(e) => {
                    saveSettings({ maintenance: e.target.checked });
                  }}
                />
                <span>Режим обслуживания</span>
              </label>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.registrationEnabled !== false}
                  onChange={(e) => {
                    saveSettings({ registrationEnabled: e.target.checked });
                  }}
                />
                <span>Регистрация включена</span>
              </label>
            </div>
            <div style={{ marginTop: '12px' }}>
              <div>Максимальный размер файла: {settings.maxFileSize ? (settings.maxFileSize / 1024 / 1024) + ' MB' : 'N/A'}</div>
              <div>Цена Premium: {settings.premiumPrice || 0} ₽/мес</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Logs — только для Lev (Intelligence Center) */}
      {isOwner && <LiveLogs />}
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

  const load = async () => {
    try {
      setLoading(true);
      const data = await api('/api/admin/users');
      setList(data.users || []);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось загрузить данные.'), 'error');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getEdit = (u: any) => editing[u.id] ?? {
    plan: u.plan || 'free',
    roles: Array.isArray(u.roles) ? u.roles.join(', ') : (u.roles || '')
  };

  const setEdit = (id: string, field: 'plan' | 'roles', value: string) => {
    setEditing(prev => {
      const cur = prev[id] ?? { plan: (list.find(x => x.id === id)?.plan || 'free'), roles: Array.isArray(list.find(x => x.id === id)?.roles) ? list.find(x => x.id === id)!.roles.join(', ') : (list.find(x => x.id === id)?.roles || '') };
      return { ...prev, [id]: { ...cur, [field]: value } };
    });
  };

  const saveUser = async (u: any) => {
    const ed = getEdit(u);
    try {
      await api(`/api/owner/users/${u.id}/plan`, 'POST', { plan: ed.plan });
      const roles = ed.roles.split(',').map((r: string) => r.trim()).filter(Boolean);
      await api(`/api/owner/users/${u.id}/role`, 'POST', { roles: roles.length ? roles : ['user'] });
      showToast('Сохранено', 'success');
      setEditing(prev => { const next = { ...prev }; delete next[u.id]; return next; });
      load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };

  const deleteUser = async () => {
    if (!deleteConfirm) return;
    try {
      await api(`/api/owner/users/${deleteConfirm.id}`, 'DELETE');
      showToast('Аккаунт удалён', 'success');
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    }
  };

  const clearDatabase = async () => {
    setClearing(true);
    try {
      await api('/api/owner/database/clear', 'POST');
      showToast('База данных очищена. Вы будете разлогинены.', 'success');
      setClearDbConfirm(false);
      localStorage.removeItem('token');
      window.location.href = '/';
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Операция не выполнена.'), 'error');
    } finally {
      setClearing(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h3 style={{ marginBottom: '16px' }}>📦 Редактирование базы данных в онлайне</h3>
      <p style={{ color: 'var(--subtle)', marginBottom: '16px' }}>Изменение плана и ролей пользователей. Удаление аккаунтов — только для не-владельцев. Сохранение применяется к серверной БД сразу.</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={load} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🔄 Обновить</button>
        <button onClick={() => setClearDbConfirm(true)} style={{ padding: '8px 16px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🗑 Очистить всю БД</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Username</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>План</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Роли (через запятую)</th>
              <th style={{ padding: '12px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {list.map(u => {
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
                      onChange={e => setEdit(u.id, 'plan', e.target.value)}
                      disabled={isOwnerUser && isSystemOwner(u)}
                      style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', minWidth: '100px' }}
                    >
                      <option value="free">free</option>
                      <option value="premium">premium</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      value={ed.roles}
                      onChange={e => setEdit(u.id, 'roles', e.target.value)}
                      disabled={isOwnerUser && isSystemOwner(u)}
                      placeholder="user, moderator, admin"
                      style={{ width: '100%', maxWidth: '220px', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                    />
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => saveUser(u)} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Сохранить</button>
                    {!isSelf && !isOwnerUser && (
                      <button onClick={() => setDeleteConfirm({ id: u.id, username: u.username })} style={{ padding: '6px 12px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Удалить</button>
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
          title="Удалить аккаунт"
          message={`Безвозвратно удалить пользователя "${deleteConfirm.username}"?`}
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
          title="Очистить всю базу данных"
          message="Удалить все данные (пользователи, чаты, сообщения и т.д.)? После очистки вы будете разлогинены. Действие необратимо."
          confirmText={clearing ? 'Очистка…' : 'Очистить БД'}
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
  const [confirmModal, setConfirmModal] = useState<{open: boolean, action: string, userId: string, username: string}>({
    open: false,
    action: '',
    userId: '',
    username: ''
  });

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

  useEffect(() => {
    let filtered = list;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.username.toLowerCase().includes(query) ||
        (u.email && u.email.toLowerCase().includes(query))
      );
    }
    
    if (filterRole !== 'all') {
      filtered = filtered.filter(u => {
        const raw = u.roles;
        const roles = Array.isArray(raw) ? raw : (raw ? String(raw).split(',').map((r: string) => r.trim().toLowerCase()) : []);
        if (filterRole === 'owner') return roles.includes('owner');
        if (filterRole === 'sysadmin') return (roles.includes('sysadmin') || roles.includes('admin')) && !roles.includes('owner');
        if (filterRole === 'safety') return (roles.includes('safety') || roles.includes('guardian')) && !roles.includes('owner') && !roles.includes('admin') && !roles.includes('sysadmin');
        if (filterRole === 'moderator') return roles.includes('moderator') && !roles.includes('safety') && !roles.includes('admin') && !roles.includes('sysadmin') && !roles.includes('owner');
        if (filterRole === 'support') return roles.includes('support') && !roles.includes('moderator') && !roles.includes('safety') && !roles.includes('admin') && !roles.includes('sysadmin') && !roles.includes('owner');
        if (filterRole === 'user') return !['owner','admin','sysadmin','safety','guardian','moderator','support'].some(r => roles.includes(r));
        return true;
      });
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => {
        if (filterStatus === 'banned') return u.status === 'banned';
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={async () => { try { const base = getApiBaseUrl(); const token = localStorage.getItem('token'); const url = base + '/api/admin/users/export' + (filterPlan !== 'all' ? '?plan=' + filterPlan : ''); const r = await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} }); const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'users.csv'; a.click(); URL.revokeObjectURL(a.href); showToast('Файл сохранён', 'success'); } catch (e: any) { showToast(getErrorMessage(e, 'Не удалось экспортировать.'), 'error'); } }} style={{ padding: '10px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontWeight: '500' }}>Экспорт CSV</button>
          <button onClick={load} style={{ padding: '10px 16px', background: 'var(--accent, #3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>🔄 Обновить</button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '600' }}>Выбрано: {selectedIds.size}</span>
          <button onClick={() => bulkAction('block')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Заблокировать</button>
          <button onClick={() => bulkAction('unblock')} disabled={bulkProcessing} style={{ padding: '8px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Разблокировать</button>
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
          placeholder="Поиск по имени или email..."
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
          <option value="owner">👑 Владелец</option>
          <option value="sysadmin">⚙️ Тех. Админ</option>
          <option value="safety">🛡️ Служба безопасности</option>
          <option value="moderator">🛡️ Модератор</option>
          <option value="support">🎫 Техподдержка</option>
          <option value="user">👤 Пользователи</option>
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
            const rawRoles = u.roles;
            const uRoles = Array.isArray(rawRoles) ? rawRoles : (rawRoles ? String(rawRoles).split(',').map((r: string) => r.trim().toLowerCase()) : []);
            const uIsOwner = uRoles.includes('owner');
            const uIsSysadmin = uRoles.includes('sysadmin') || uRoles.includes('admin');
            const uIsSafety = uRoles.includes('safety') || uRoles.includes('guardian');
            const uIsModerator = uRoles.includes('moderator');
            const uIsSupport = uRoles.includes('support');
            const uIsBanned = u.status === 'banned';
            const systemOwner = isSystemOwner(u);
            const canBlock = canBlockUser(currentUser, u);
            const canDemote = canDemoteUser(currentUser, u);
            const canPromoteAdmin = canPromoteTo(currentUser, 'admin');
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
                      {systemOwner && <span title="Встроенный системный владелец" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>Системный владелец</span>}
                      {uIsOwner && !systemOwner && <span title="Владелец">👑</span>}
                      {uIsSysadmin && !uIsOwner && <span title="Тех. Админ">⚙️</span>}
                      {uIsSafety && !uIsSysadmin && !uIsOwner && <span title="Служба безопасности">🛡️</span>}
                      {uIsModerator && !uIsSafety && !uIsSysadmin && !uIsOwner && <span title="Модератор">🛡️</span>}
                      {uIsSupport && !uIsModerator && !uIsSafety && !uIsSysadmin && !uIsOwner && <span title="Техподдержка">🎫</span>}
                    </div>
                    <div className="small" style={{marginBottom: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                      <span>Роли: <strong>{Array.isArray(u.roles) ? u.roles.join(', ') : (u.roles || 'user')}</strong></span>
                      <span>|</span>
                      <span>Статус: <strong>{uIsBanned ? '🚫 Заблокирован' : u.status || 'online'}</strong></span>
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
          confirmModal.action === 'promote' ? 'Назначить администратором' :
          confirmModal.action === 'demote' ? 'Снять права администратора' :
          confirmModal.action === 'delete' ? 'Удалить аккаунт' : 'Подтверждение'
        }
        message={
          confirmModal.action === 'block' ? `Вы уверены, что хотите заблокировать пользователя "${confirmModal.username}"?` :
          confirmModal.action === 'promote' ? `Назначить пользователя "${confirmModal.username}" администратором?` :
          confirmModal.action === 'demote' ? `Снять права администратора у пользователя "${confirmModal.username}"?` :
          confirmModal.action === 'delete' ? `Безвозвратно удалить аккаунт "${confirmModal.username}"? Данные пользователя будут удалены.` : 'Подтвердите действие'
        }
        confirmText="Подтвердить"
        cancelText="Отмена"
        danger={confirmModal.action === 'block' || confirmModal.action === 'delete'}
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
      .then((all: any[]) => Array.isArray(all) ? all.filter((f: any) => (f.subject || '').includes('Заявка на тариф')) : [])
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
  return (
    <div>
      <div style={{marginBottom: '24px'}}>
        <h3 style={{fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}>Заявки на Premium / Enterprise</h3>
        <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
          Рассмотрите заявки и выдайте тариф во вкладке «Пользователи» (план Premium).
        </div>
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
  return (
    <div>
      <div style={{marginBottom: '24px'}}>
        <h3 style={{fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}>Набор: тестировщики и хелперы</h3>
        <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
          Заявки с публичной страницы <a href="/join" target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)'}}>/join</a>. Всего: {list.length}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty" style={{padding: '48px'}}>Нет заявок</div>
      ) : (
        <div style={{display: 'grid', gap: '12px'}}>
          {list.map((a: any) => (
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
