
import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function ChatList() {
  const [chats, setChats] = useState([]);
  const [createTarget, setCreateTarget] = useState('');

  useEffect(() => {
    api('/api/chats').then(setChats).catch(()=>{});
  }, []);

  const createDM = async () => {
    try {
      const r = await api('/api/chats', 'POST', { type: 'dm', memberId: createTarget });
      setChats(prev => {
        const has = prev.find(c => c.id === r.id);
        return has ? prev : [r, ...prev];
      });
      setCreateTarget('');
      alert('DM создан (или найден существующий). Откройте чат справа в окне сообщений (введите chatId).');
    } catch (e) { alert('Ошибка создания DM'); }
  };

  const createChannel = async () => {
    const title = prompt('Название канала:');
    const category = prompt('Категория (например: general, sales):');
    try {
      const r = await api('/api/chats', 'POST', { type: 'channel', title, category });
      setChats([r, ...chats]);
      if (r.requiresReview && !r.approved) alert('Канал отправлен на модерацию (sales).');
    } catch (e) { alert('Ошибка создания канала'); }
  };

  return (
    <div>
      <div className="title">Мои чаты</div>
      <div className="small">Выбери chatId и открой справа</div>
      <hr/>
      {chats.map(c => (
        <div className="list-item" key={c.id}>
          <div>{c.type.toUpperCase()} — {c.title || '(без названия)'}</div>
          <div className="small">id: {c.id}</div>
          {c.type==='channel' && c.requiresReview && !c.approved && <div className="small">⏳ На модерации</div>}
        </div>
      ))}
      <hr/>
      <div className="row">
        <input placeholder="ID второго пользователя для DM" value={createTarget} onChange={e=>setCreateTarget(e.target.value)} />
        <button onClick={createDM}>DM</button>
      </div>
      <div style={{marginTop: 8}}>
        <button onClick={createChannel}>Создать канал</button>
      </div>
    </div>
  );
}
