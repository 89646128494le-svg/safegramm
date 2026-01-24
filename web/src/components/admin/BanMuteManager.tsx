import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { ConfirmModal } from '../Modal';
import { useTranslation } from '../../i18n';

interface Ban {
  id: string;
  userId: string;
  username: string;
  reason: string;
  bannedBy: string;
  bannedAt: number;
  expiresAt?: number;
  permanent: boolean;
  active: boolean;
}

interface Mute {
  id: string;
  userId: string;
  username: string;
  chatId: string;
  chatName: string;
  reason: string;
  mutedBy: string;
  mutedAt: number;
  expiresAt?: number;
  permanent: boolean;
  active: boolean;
}

export default function BanMuteManager() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'bans' | 'mutes' | 'history'>('bans');
  const [bans, setBans] = useState<Ban[]>([]);
  const [mutes, setMutes] = useState<Mute[]>([]);
  const [history, setHistory] = useState<Array<Ban | Mute>>([]);
  const [loading, setLoading] = useState(true);
  const [banModal, setBanModal] = useState<{ open: boolean; userId?: string; username?: string }>({ open: false });
  const [muteModal, setMuteModal] = useState<{ open: boolean; userId?: string; username?: string; chatId?: string; chatName?: string }>({ open: false });
  const [banForm, setBanForm] = useState({ reason: '', duration: '', permanent: false });
  const [muteForm, setMuteForm] = useState({ reason: '', duration: '', permanent: false });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'bans') {
        const response = await api('/api/admin/bans');
        if (response === null) {
          // Эндпоинт не реализован
          setBans([]);
          return;
        }
        setBans(response?.bans || []);
      } else if (activeTab === 'mutes') {
        const response = await api('/api/admin/mutes');
        if (response === null) {
          setMutes([]);
          return;
        }
        setMutes(response?.mutes || []);
      } else {
        const response = await api('/api/admin/moderation/history');
        if (response === null) {
          setHistory([]);
          return;
        }
        setHistory(response?.history || []);
      }
    } catch (e: any) {
      // Игнорируем 404 - эндпоинт еще не реализован
      if (e.status === 404 || e.errorCode === 'not_found') {
        if (activeTab === 'bans') setBans([]);
        else if (activeTab === 'mutes') setMutes([]);
        else setHistory([]);
        return;
      }
      showToast('Ошибка загрузки: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async () => {
    if (!banModal.userId) return;
    
    try {
      const expiresAt = banForm.permanent ? undefined : 
        banForm.duration ? Date.now() + parseInt(banForm.duration) * 1000 : undefined;
      
      await api('/api/admin/bans', 'POST', {
        userId: banModal.userId,
        reason: banForm.reason,
        permanent: banForm.permanent,
        expiresAt
      });
      
      showToast('Пользователь забанен', 'success');
      setBanModal({ open: false });
      setBanForm({ reason: '', duration: '', permanent: false });
      loadData();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const handleMute = async () => {
    if (!muteModal.userId || !muteModal.chatId) return;
    
    try {
      const expiresAt = muteForm.permanent ? undefined :
        muteForm.duration ? Date.now() + parseInt(muteForm.duration) * 1000 : undefined;
      
      await api('/api/admin/mutes', 'POST', {
        userId: muteModal.userId,
        chatId: muteModal.chatId,
        reason: muteForm.reason,
        permanent: muteForm.permanent,
        expiresAt
      });
      
      showToast('Пользователь замьючен', 'success');
      setMuteModal({ open: false });
      setMuteForm({ reason: '', duration: '', permanent: false });
      loadData();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const unban = async (banId: string) => {
    try {
      await api(`/api/admin/bans/${banId}`, 'DELETE');
      showToast('Бан снят', 'success');
      loadData();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const unmute = async (muteId: string) => {
    try {
      await api(`/api/admin/mutes/${muteId}`, 'DELETE');
      showToast('Мут снят', 'success');
      loadData();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  return (
    <div>
      {/* Вкладки */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border, #374151)',
        paddingBottom: '16px'
      }}>
        {(['bans', 'mutes', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              fontWeight: activeTab === tab ? '600' : '400',
              background: activeTab === tab ? 'var(--accent, #3b82f6)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--fg, #e5e7eb)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {tab === 'bans' ? '🚫 Баны' : tab === 'mutes' ? '🔇 Муты' : '📜 История'}
          </button>
        ))}
      </div>

      {/* Контент */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div className="empty">{t('common.loading')}</div>
        </div>
      ) : activeTab === 'bans' ? (
        <BansList bans={bans} onUnban={unban} onBanClick={(userId, username) => setBanModal({ open: true, userId, username })} />
      ) : activeTab === 'mutes' ? (
        <MutesList mutes={mutes} onUnmute={unmute} onMuteClick={(userId, username, chatId, chatName) => setMuteModal({ open: true, userId, username, chatId, chatName })} />
      ) : (
        <ModerationHistory history={history} />
      )}

      {/* Модальное окно бана */}
      <ConfirmModal
        isOpen={banModal.open}
        onClose={() => setBanModal({ open: false })}
        onConfirm={handleBan}
        title="Забанить пользователя"
        message={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>Пользователь: <strong>{banModal.username}</strong></div>
            <input
              type="text"
              placeholder="Причина бана"
              value={banForm.reason}
              onChange={e => setBanForm({ ...banForm, reason: e.target.value })}
              style={{
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e9ecf5'
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={banForm.permanent}
                onChange={e => setBanForm({ ...banForm, permanent: e.target.checked })}
              />
              <span>Постоянный бан</span>
            </label>
            {!banForm.permanent && (
              <input
                type="number"
                placeholder="Длительность в секундах (например, 3600 для 1 часа)"
                value={banForm.duration}
                onChange={e => setBanForm({ ...banForm, duration: e.target.value })}
                style={{
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#e9ecf5'
                }}
              />
            )}
          </div>
        }
        confirmText="Забанить"
        cancelText="Отмена"
        confirmColor="danger"
      />

      {/* Модальное окно мута */}
      <ConfirmModal
        isOpen={muteModal.open}
        onClose={() => setMuteModal({ open: false })}
        onConfirm={handleMute}
        title="Замьютить пользователя"
        message={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>Пользователь: <strong>{muteModal.username}</strong></div>
            <div>Чат: <strong>{muteModal.chatName}</strong></div>
            <input
              type="text"
              placeholder="Причина мута"
              value={muteForm.reason}
              onChange={e => setMuteForm({ ...muteForm, reason: e.target.value })}
              style={{
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e9ecf5'
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={muteForm.permanent}
                onChange={e => setMuteForm({ ...muteForm, permanent: e.target.checked })}
              />
              <span>Постоянный мут</span>
            </label>
            {!muteForm.permanent && (
              <input
                type="number"
                placeholder="Длительность в секундах"
                value={muteForm.duration}
                onChange={e => setMuteForm({ ...muteForm, duration: e.target.value })}
                style={{
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#e9ecf5'
                }}
              />
            )}
          </div>
        }
        confirmText="Замьютить"
        cancelText="Отмена"
        confirmColor="danger"
      />
    </div>
  );
}

function BansList({ bans, onUnban, onBanClick }: {
  bans: Ban[];
  onUnban: (id: string) => void;
  onBanClick: (userId: string, username: string) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => onBanClick('', '')}
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
          ➕ Добавить бан
        </button>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {bans.filter(b => b.active).map(ban => (
          <div
            key={ban.id}
            style={{
              padding: '16px',
              background: 'var(--panel, rgba(31, 41, 55, 0.6))',
              border: '1px solid var(--border, #374151)',
              borderRadius: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>{ban.username}</div>
                <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)', marginBottom: '4px' }}>
                  Причина: {ban.reason || 'Не указана'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)' }}>
                  Забанен: {new Date(ban.bannedAt).toLocaleString('ru-RU')}
                  {ban.expiresAt && !ban.permanent && (
                    <> • Истекает: {new Date(ban.expiresAt).toLocaleString('ru-RU')}</>
                  )}
                  {ban.permanent && <> • Постоянный</>}
                </div>
              </div>
              <button
                onClick={() => onUnban(ban.id)}
                style={{
                  padding: '8px 16px',
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Разбанить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MutesList({ mutes, onUnmute, onMuteClick }: {
  mutes: Mute[];
  onUnmute: (id: string) => void;
  onMuteClick: (userId: string, username: string, chatId: string, chatName: string) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => onMuteClick('', '', '', '')}
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
          ➕ Добавить мут
        </button>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {mutes.filter(m => m.active).map(mute => (
          <div
            key={mute.id}
            style={{
              padding: '16px',
              background: 'var(--panel, rgba(31, 41, 55, 0.6))',
              border: '1px solid var(--border, #374151)',
              borderRadius: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                  {mute.username} в {mute.chatName}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)', marginBottom: '4px' }}>
                  Причина: {mute.reason || 'Не указана'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)' }}>
                  Замьючен: {new Date(mute.mutedAt).toLocaleString('ru-RU')}
                  {mute.expiresAt && !mute.permanent && (
                    <> • Истекает: {new Date(mute.expiresAt).toLocaleString('ru-RU')}</>
                  )}
                  {mute.permanent && <> • Постоянный</>}
                </div>
              </div>
              <button
                onClick={() => onUnmute(mute.id)}
                style={{
                  padding: '8px 16px',
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Размьютить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModerationHistory({ history }: { history: Array<Ban | Mute> }) {
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {history.map((item, idx) => (
        <div
          key={idx}
          style={{
            padding: '16px',
            background: 'var(--panel, rgba(31, 41, 55, 0.6))',
            border: '1px solid var(--border, #374151)',
            borderRadius: '12px'
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>
            {'chatId' in item ? `🔇 Мут: ${item.username} в ${item.chatName}` : `🚫 Бан: ${item.username}`}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)' }}>
            Причина: {item.reason || 'Не указана'} • {new Date(item.bannedAt || item.mutedAt).toLocaleString('ru-RU')}
            {!item.active && <span style={{ color: '#22c55e' }}> • Снято</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
