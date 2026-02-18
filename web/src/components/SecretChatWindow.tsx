
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/websocket';
import { deriveSessionKeyForChat, encryptPlaintext, decryptCiphertext, getMyPublicJwk } from '../services/crypto';

interface SecretChatWindowProps {
  chatId: string;
  currentUser: { id: string; username: string };
  peerUser: { id: string; username: string; publicKeyJwk?: any };
  onClose?: () => void;
}

export default function SecretChatWindow({ chatId, currentUser, peerUser, onClose }: SecretChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [keyVerified, setKeyVerified] = useState(false);
  const [screenshotProtection, setScreenshotProtection] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    // Защита от скриншотов
    if (screenshotProtection) {
      // Блокируем контекстное меню (правый клик)
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
      };
      
      // Блокируем DevTools
      const handleDevTools = (e: KeyboardEvent) => {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'J') ||
            (e.ctrlKey && e.key === 'U')) {
          e.preventDefault();
          alert('Разработческие инструменты заблокированы в секретных чатах');
          return false;
        }
      };
      
      // Блокируем PrintScreen и комбинации для скриншотов
      const handleScreenshotAttempt = (e: KeyboardEvent) => {
        if (e.key === 'PrintScreen' || 
            (e.ctrlKey && e.shiftKey && e.key === 'S') ||
            (e.metaKey && e.shiftKey && e.key === '3') ||
            (e.metaKey && e.shiftKey && e.key === '4')) {
          e.preventDefault();
          alert('Скриншоты запрещены в секретных чатах');
          return false;
        }
      };
      
      // Блокируем копирование текста
      const handleCopy = (e: ClipboardEvent) => {
        e.preventDefault();
        alert('Копирование текста запрещено в секретных чатах');
        return false;
      };
      
      // Блокируем выделение текста
      const handleSelectStart = (e: Event) => {
        e.preventDefault();
        return false;
      };
      
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleDevTools);
      document.addEventListener('keydown', handleScreenshotAttempt);
      document.addEventListener('copy', handleCopy);
      document.addEventListener('selectstart', handleSelectStart);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // CSS защита от выделения
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      
      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleDevTools);
        document.removeEventListener('keydown', handleScreenshotAttempt);
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('selectstart', handleSelectStart);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
      };
    }
  }, [screenshotProtection]);

  const handleVisibilityChange = () => {
    if (document.hidden && screenshotProtection) {
      // При скрытии окна можно показать предупреждение
      console.warn('Окно скрыто - возможна попытка скриншота');
    }
  };

  useEffect(() => {
    initSecretChat();
  }, [peerUser.id, chatId]);

  const initSecretChat = async () => {
    try {
      // Получаем публичный ключ собеседника
      const peerKey = await api(`/api/users/${peerUser.id}/public_key`);
      if (!peerKey.publicKeyJwk) {
        alert('У собеседника нет публичного ключа');
        return;
      }

      // Получаем свой публичный ключ
      const myPubKey = await getMyPublicJwk();

      // Ключ сессии, привязанный к chatId (SafeGram Shield)
      const key = await deriveSessionKeyForChat(peerKey.publicKeyJwk, chatId);
      setSharedKey(key);

      // Создаем или получаем секретный чат
      const hash = await crypto.subtle.digest('SHA-256', await crypto.subtle.exportKey('raw', key));
      const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const secretChat = await api('/api/secret-chats', 'POST', {
        userId2: peerUser.id,
        sharedKeyHash: hashHex
      });

      // Загружаем сообщения
      loadMessages();
    } catch (e) {
      console.error('Failed to init secret chat:', e);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await api(`/api/chats/${chatId}/messages`);
      // Расшифровываем сообщения
      const decrypted = await Promise.all(
        (data.messages || []).map(async (msg: any) => {
          if (msg.ciphertext && sharedKey) {
            try {
              const plaintext = await decryptCiphertext(sharedKey, msg.ciphertext);
              return { ...msg, plaintext };
            } catch {
              return { ...msg, plaintext: '[Не удалось расшифровать]' };
            }
          }
          return msg;
        })
      );
      setMessages(decrypted);
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || !sharedKey) return;

    try {
      const ciphertext = await encryptPlaintext(sharedKey, text);
      await api(`/api/chats/${chatId}/messages`, 'POST', { ciphertext });
      setText('');
      await loadMessages();
    } catch (e: any) {
      alert('Ошибка отправки: ' + (e.message || 'unknown'));
    }
  };

  const [myFingerprint, setMyFingerprint] = useState<string>('');
  const [peerFingerprint, setPeerFingerprint] = useState<string>('');
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);

  useEffect(() => {
    const loadFingerprints = async () => {
      try {
        const { getMyKeyFingerprint, getKeyFingerprint } = await import('../services/crypto');
        const myFp = await getMyKeyFingerprint();
        setMyFingerprint(myFp);
        
        const peerKey = await api(`/api/users/${peerUser.id}/public_key`);
        if (peerKey.publicKeyJwk) {
          const peerFp = await getKeyFingerprint(peerKey.publicKeyJwk);
          setPeerFingerprint(peerFp);
        }
      } catch (e) {
        console.error('Failed to load fingerprints:', e);
      }
    };
    loadFingerprints();
  }, [peerUser.id]);

  const verifyKey = async () => {
    setShowFingerprintModal(true);
  };

  const confirmFingerprintMatch = () => {
    const confirmed = window.confirm(
      `Ваш отпечаток: ${myFingerprint}\n\nОтпечаток собеседника: ${peerFingerprint}\n\nСовпадают ли отпечатки с тем, что показывает собеседник?`
    );
    if (confirmed) {
      setKeyVerified(true);
      setShowFingerprintModal(false);
      // Сохраняем проверку в localStorage
      localStorage.setItem(`key_verified_${chatId}`, 'true');
    }
  };

  return (
    <div className="secret-chat-window">
      <div className="secret-chat-header">
        <div className="secret-chat-title">
          <span className="secret-badge">🔒</span>
          {peerUser.username}
          {!keyVerified && (
            <button onClick={verifyKey} className="verify-key-btn">
              Проверить ключ
            </button>
          )}
          {keyVerified && <span className="verified-badge">✓ Проверено</span>}
        </div>
        {onClose && <button onClick={onClose}>✕</button>}
      </div>

      {/* Модальное окно проверки отпечатков */}
      {showFingerprintModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid var(--border)'
          }}>
            <h3 style={{ marginTop: 0 }}>Проверка отпечатков ключей</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Сравните отпечатки ключей с собеседником. Они должны совпадать.
            </p>
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <strong>Ваш отпечаток:</strong>
                <div style={{ 
                  color: 'var(--accent-primary)', 
                  marginTop: '4px',
                  wordBreak: 'break-all'
                }}>
                  {myFingerprint}
                </div>
              </div>
              <div>
                <strong>Отпечаток собеседника:</strong>
                <div style={{ 
                  color: 'var(--accent-primary)', 
                  marginTop: '4px',
                  wordBreak: 'break-all'
                }}>
                  {peerFingerprint}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowFingerprintModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                Отмена
              </button>
              <button
                onClick={confirmFingerprintMatch}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Подтвердить совпадение
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="secret-chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.senderId === currentUser.id ? 'me' : ''}`}>
            <div className="message-text">
              {msg.plaintext || msg.text || '[Зашифровано]'}
            </div>
            <div className="message-time">
              {new Date(msg.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="secret-chat-input">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Зашифрованное сообщение..."
          disabled={!sharedKey}
        />
        <button onClick={sendMessage} disabled={!sharedKey || !text.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}




