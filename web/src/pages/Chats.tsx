
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/websocket';
import { ensureKeys, deriveSharedKey, encryptPlaintext, decryptCiphertext } from '../services/crypto';

export default function Chats() {
  const [chats, setChats] = useState<any[]>([]);
  const [chatId, setChatId] = useState('');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [peerId, setPeerId] = useState('');
  const sharedKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => { ensureKeys(); }, []);

  useEffect(() => {
    api('/api/chats').then(setChats).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!chatId) return;
    api(`/api/chats/${chatId}/messages`).then(setMsgs).catch(()=>{});
    const s = getSocket();
    s.emit('join', chatId);
    const handler = async (m: any) => {
      if (m.chatId !== chatId) return;
      const plain = sharedKeyRef.current ? await decryptCiphertext(sharedKeyRef.current, m.ciphertext).catch(()=>null) : null;
      setMsgs(prev => [...prev, { ...m, plaintext: plain }]);
    };
    s.on('message', handler);
    return () => { s.off('message', handler); };
  }, [chatId]);

  const createDM = async () => {
    const memberId = prompt('Введи ID собеседника:');
    if (!memberId) return;
    const r = await api('/api/chats', 'POST', { type: 'dm', memberId });
    setChats(prev => {
      const has = prev.find(c => c.id === r.id);
      return has ? prev : [r, ...prev];
    });
    alert('DM создан/найден. Выбери его в списке.');
  };

  const createChannel = async () => {
    const title = prompt('Название канала:');
    const category = prompt('Категория (например: general, sales):');
    const r = await api('/api/chats', 'POST', { type: 'channel', title, category });
    setChats(prev => [r, ...prev]);
    if (r.requiresReview && !r.approved) alert('Канал на модерации (sales).');
  };

  const prepareKey = async () => {
    if (!peerId) { alert('Укажи ID собеседника'); return; }
    const myInfo = await api('/api/users/me');
    const peer = await api(`/api/users/${peerId}/public_key`);
    const key = await deriveSharedKey(myInfo.pubKey, peer.publicKeyJwk);
    sharedKeyRef.current = key;
    alert('Ключ установлен (ECDH + AES-GCM).');
  };

  const send = async () => {
    if (!chatId) return alert('Укажи chatId');
    if (!sharedKeyRef.current) return alert('Сначала установи общий ключ (peerId + кнопка)');
    const ciphertext = await encryptPlaintext(sharedKeyRef.current, text);
    await api(`/api/chats/${chatId}/messages`, 'POST', { ciphertext });
    setText('');
    setMsgs(prev => [...prev, { id: Math.random().toString(36).slice(2), chatId, senderId: 'me', ciphertext, plaintext: text, createdAt: new Date().toISOString() }]);
  };

  return (
    <div className="container">
      <div className="sidebar">
        <div className="title">Мои чаты</div>
        <div style={{margin: '8px 0'}}>
          <button onClick={createDM}>+ DM</button>{' '}
          <button onClick={createChannel}>+ Канал</button>
        </div>
        <hr/>
        {chats.map(c => (
          <div className="list-item" key={c.id} onClick={()=>setChatId(c.id)}>
            <div>{c.type.toUpperCase()} — {c.title || '(без названия)'}</div>
            <div className="small">id: {c.id}</div>
            {c.type==='channel' && c.requiresReview && !c.approved && <div className="small">⏳ На модерации</div>}
          </div>
        ))}
      </div>
      <div className="main">
        <div className="header">
          <input placeholder="chatId" value={chatId} onChange={e=>setChatId(e.target.value)} />
          <div className="row">
            <input placeholder="ID собеседника (для E2EE)" value={peerId} onChange={e=>setPeerId(e.target.value)} />
            <button onClick={prepareKey}>Установить ключ</button>
          </div>
        </div>
        <div className="messages">
          {msgs.map(m => (
            <div key={m.id} className={"msg " + (m.senderId==='me' ? 'me':'') }>
              <div className="small">{new Date(m.createdAt).toLocaleString()}</div>
              <div>{m.plaintext ?? '(зашифровано)'}</div>
            </div>
          ))}
        </div>
        <div className="inputbar">
          <input placeholder="Сообщение (E2EE)" value={text} onChange={e=>setText(e.target.value)} />
          <button onClick={send}>Отправить</button>
        </div>
      </div>
    </div>
  );
}
