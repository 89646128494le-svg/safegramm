
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
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
import SecurityDashboard from '../../components/admin/SecurityDashboard';
import SupportTab from '../../components/admin/SupportTab';
import LiveLogs from '../../components/admin/LiveLogs';
import { ADMIN_TABS, canAccessAdminTab, getRoleLabel, getRoleLevel, isSystemOwner, canBlockUser, canDemoteUser, canPromoteTo, ROLE_LEVEL } from '../../utils/roles';

type AdminTabId = typeof ADMIN_TABS[number]['id'];

export default function Admin() {
  const [tab, setTab] = useState<AdminTabId>('users');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const u = await api('/api/users/me');
      setUser(u);
      const firstTab = ADMIN_TABS.find(t => canAccessAdminTab(u, t.id));
      if (firstTab) setTab(firstTab.id);
    } catch (e) {
      console.error('Failed to load user:', e);
    }
  };

  const roleLabel = user ? getRoleLabel(user) : '';

  return (
    <div style={{padding: '24px', maxWidth: 1400, margin: '0 auto'}}>
      <h2 style={{marginBottom: '24px', fontSize: '28px', fontWeight: '700'}}>
        Панель управления
        {roleLabel && (
          <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--subtle, #9ca3af)', marginLeft: '12px' }}>
            {roleLabel === 'Владелец' && '👑 Владелец'}
            {roleLabel === 'Тех. Админ' && '⚙️ Тех. Админ'}
            {roleLabel === 'Служба безопасности' && '🛡️ Служба безопасности'}
            {roleLabel === 'Модератор' && '🛡️ Модератор'}
            {roleLabel === 'Техподдержка' && '🎫 Техподдержка'}
          </span>
        )}
      </h2>
      <div style={{
        display: 'flex', 
        gap: '8px', 
        flexWrap: 'wrap', 
        marginBottom: '24px',
        borderBottom: '1px solid var(--border, #374151)',
        paddingBottom: '16px'
      }}>
        {ADMIN_TABS.map(({ id, label }) => {
          if (!canAccessAdminTab(user, id)) return null;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '10px 16px',
                fontWeight: tab === id ? '600' : '400',
                background: tab === id ? 'var(--accent, #3b82f6)' : 'transparent',
                color: tab === id ? '#fff' : 'var(--fg, #e5e7eb)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {tab==='sovereign' && canAccessAdminTab(user, 'sovereign') && <OwnerTab currentUser={user} />}
      {tab==='users' && canAccessAdminTab(user, 'users') && <UsersTab currentUser={user} />}
      {tab==='analytics' && canAccessAdminTab(user, 'analytics') && <AnalyticsDashboard />}
      {tab==='bans' && canAccessAdminTab(user, 'bans') && <BanMuteManager />}
      {tab==='maintenance' && canAccessAdminTab(user, 'maintenance') && <MaintenanceManager />}
      {tab==='broadcast' && canAccessAdminTab(user, 'broadcast') && <BroadcastManager />}
      {tab==='messages' && canAccessAdminTab(user, 'messages') && <AdminMessaging />}
      {tab==='logs' && canAccessAdminTab(user, 'logs') && <AdminLogs />}
      {tab==='monitor' && canAccessAdminTab(user, 'monitor') && <SystemMonitor />}
      {tab==='security' && canAccessAdminTab(user, 'security') && <SecurityDashboard />}
      {tab==='mod' && canAccessAdminTab(user, 'mod') && <ModTab/>}
      {tab==='reports' && canAccessAdminTab(user, 'reports') && <ReportsTab/>}
      {tab==='feedback' && canAccessAdminTab(user, 'feedback') && <FeedbackTab/>}
      {tab==='premium_apps' && canAccessAdminTab(user, 'premium_apps') && <PremiumApplicationsTab />}
      {tab==='push' && canAccessAdminTab(user, 'push') && <PushTab/>}
      {tab==='services' && canAccessAdminTab(user, 'services') && <ServiceManager />}
      {tab==='webhook' && canAccessAdminTab(user, 'webhook') && <WebhookManager />}
      {tab==='support' && canAccessAdminTab(user, 'support') && <SupportTab />}
    </div>
  );
}

function OwnerTab({ currentUser }: { currentUser: any }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
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
    } else {
      setLoading(false);
    }
  }, [isOwner, isSysadmin]);

  const loadDashboard = async () => {
    try {
      const data = await api('/api/owner/dashboard');
      setDashboard(data);
    } catch (e: any) {
      showToast('Ошибка загрузки: ' + e.message, 'error');
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
      showToast('Ошибка сохранения: ' + e.message, 'error');
    }
  };

  const setPlan = async (userId: string, plan: 'free' | 'premium') => {
    try {
      await api(`/api/owner/users/${userId}/plan`, 'POST', { plan });
      showToast(`План пользователя изменен на ${plan}`, 'success');
      loadDashboard();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    try {
      await api(`/api/owner/users/${userId}`, 'DELETE');
      showToast('Пользователь удален', 'success');
      loadDashboard();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
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

function UsersTab({ currentUser }: { currentUser: any }) {
  const [list, setList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [confirmModal, setConfirmModal] = useState<{open: boolean, action: string, userId: string, username: string}>({
    open: false,
    action: '',
    userId: '',
    username: ''
  });

  const load = async () => {
    try {
      setLoading(true);
      const data = await api('/api/admin/users');
      setList(data.users || []);
      setFilteredList(data.users || []);
    } catch (e: any) {
      console.error('Failed to load users:', e);
      showToast('Ошибка загрузки: ' + e.message, 'error');
      setList([]);
      setFilteredList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      showToast('Ошибка: ' + e.message, 'error');
    }
  };
  
  const promoteUser = async (id: string, username: string) => {
    setConfirmModal({ open: true, action: 'promote', userId: id, username });
  };
  
  const demoteUser = async (id: string, username: string) => {
    setConfirmModal({ open: true, action: 'demote', userId: id, username });
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
      }
      await load();
      setConfirmModal({ open: false, action: '', userId: '', username: '' });
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
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
      </div>

      {filteredList.length === 0 ? (
        <div className="empty" style={{padding: '48px'}}>
          {list.length === 0 ? 'Нет пользователей' : 'Ничего не найдено'}
        </div>
      ) : (
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
                {!systemOwner && (canBlock || canDemote) && (
                  <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border, #374151)'}}>
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
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, action: '', userId: '', username: '' })}
        onConfirm={handleConfirm}
        title={
          confirmModal.action === 'block' ? 'Заблокировать пользователя' :
          confirmModal.action === 'promote' ? 'Назначить администратором' :
          confirmModal.action === 'demote' ? 'Снять права администратора' :
          'Подтверждение'
        }
        message={
          confirmModal.action === 'block' ? `Вы уверены, что хотите заблокировать пользователя "${confirmModal.username}"?` :
          confirmModal.action === 'promote' ? `Назначить пользователя "${confirmModal.username}" администратором?` :
          confirmModal.action === 'demote' ? `Снять права администратора у пользователя "${confirmModal.username}"?` :
          'Подтвердите действие'
        }
        confirmText="Подтвердить"
        cancelText="Отмена"
        danger={confirmModal.action === 'block'}
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
      showToast('Ошибка загрузки: ' + e.message, 'error');
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
      showToast('Ошибка: ' + e.message, 'error');
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
