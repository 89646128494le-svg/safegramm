import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

export default function ContentModerationTab() {
  const [activeSection, setActiveSection] = useState<'search' | 'media' | 'stickers' | 'banned'>('search');
  const [searchQ, setSearchQ] = useState('');
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [mediaQueue, setMediaQueue] = useState<any[]>([]);
  const [stickerPacks, setStickerPacks] = useState<any[]>([]);
  const [bannedWords, setBannedWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [newAction, setNewAction] = useState('warn');

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setLoading(true);
    try {
      const data = await api(`/api/admin/messages/search?q=${encodeURIComponent(searchQ)}`);
      setSearchResult(data?.messages || []);
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'media') {
      api('/api/admin/media-queue').then((d) => setMediaQueue(d?.queue || [])).catch(() => setMediaQueue([]));
    } else if (activeSection === 'stickers') {
      api('/api/admin/sticker-packs?status=pending').then((d) => setStickerPacks(d?.packs || [])).catch(() => setStickerPacks([]));
    } else if (activeSection === 'banned') {
      api('/api/admin/banned-words').then((d) => setBannedWords(d?.list || [])).catch(() => setBannedWords([]));
    }
  }, [activeSection]);

  const approveSticker = async (id: string) => {
    try {
      await api(`/api/admin/sticker-packs/${id}/approve`, 'POST', {});
      showToast('Одобрено', 'success');
      setStickerPacks((p) => p.filter((x) => x.id !== id));
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const rejectSticker = async (id: string) => {
    try {
      await api(`/api/admin/sticker-packs/${id}/reject`, 'POST', {});
      showToast('Отклонено', 'success');
      setStickerPacks((p) => p.filter((x) => x.id !== id));
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const addBannedWord = async () => {
    if (!newPhrase.trim()) return;
    try {
      await api('/api/admin/banned-words', 'POST', { phrase: newPhrase.trim(), action: newAction });
      showToast('Добавлено', 'success');
      setNewPhrase('');
      const d = await api('/api/admin/banned-words');
      setBannedWords(d?.list || []);
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const deleteBannedWord = async (id: string) => {
    try {
      await api(`/api/admin/banned-words/${id}`, 'DELETE');
      setBannedWords((p) => p.filter((x) => x.id !== id));
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const setMessageModeration = async (msgId: string, status: string) => {
    try {
      await api(`/api/admin/messages/${msgId}/moderation`, 'POST', { status, reason: '' });
      showToast('Обновлено', 'success');
      setMediaQueue((q) => q.filter((m) => m.id !== msgId));
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const sections = [
    { id: 'search' as const, label: 'Поиск по сообщениям' },
    { id: 'media' as const, label: 'Очередь медиа' },
    { id: 'stickers' as const, label: 'Стикерпаки на модерации' },
    { id: 'banned' as const, label: 'Запрещённые слова' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: '10px 16px',
              background: activeSection === s.id ? 'var(--accent)' : 'var(--panel-2)',
              color: activeSection === s.id ? '#fff' : 'var(--fg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'search' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              placeholder="Текст сообщения"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              style={{ padding: 10, width: 300, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <button onClick={doSearch} disabled={loading} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Искать
            </button>
          </div>
          {searchResult.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {searchResult.slice(0, 50).map((m) => (
                <div key={m.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Чат: {m.chatId} · От: {m.senderId} · {new Date(m.createdAt).toLocaleString('ru-RU')}</div>
                  <div style={{ marginTop: 4 }}>{m.text || '(медиа)'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'media' && (
        <div>
          {mediaQueue.length === 0 ? (
            <div className="empty" style={{ padding: 48 }}>Нет медиа в очереди</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {mediaQueue.map((m) => (
                <div key={m.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {m.attachmentUrl && (
                    <img src={m.attachmentUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Сообщение {m.id} · Чат {m.chatId}</div>
                  </div>
                  <button onClick={() => setMessageModeration(m.id, 'approved')} style={{ padding: '6px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Одобрить</button>
                  <button onClick={() => setMessageModeration(m.id, 'rejected')} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отклонить</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'stickers' && (
        <div>
          {stickerPacks.length === 0 ? (
            <div className="empty" style={{ padding: 48 }}>Нет паков на модерации</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {stickerPacks.map((p) => (
                <div key={p.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{p.title || p.name} ({p.id})</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approveSticker(p.id)} style={{ padding: '6px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Одобрить</button>
                    <button onClick={() => rejectSticker(p.id)} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отклонить</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'banned' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              placeholder="Фраза"
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              style={{ padding: 10, width: 200, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <select value={newAction} onChange={(e) => setNewAction(e.target.value)} style={{ padding: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <option value="warn">Предупреждение</option>
              <option value="ban">Бан</option>
              <option value="delete_message">Удалить сообщение</option>
            </select>
            <button onClick={addBannedWord} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Добавить</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {bannedWords.map((w) => (
              <div key={w.id} style={{ padding: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>{w.phrase}</strong> → {w.action}</span>
                <button onClick={() => deleteBannedWord(w.id)} style={{ padding: '4px 10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer' }}>Удалить</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
