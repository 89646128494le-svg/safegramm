
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/websocket';
import { deriveSharedKey, encryptPlaintext, decryptCiphertext, getMyPublicJwk } from '../services/crypto';

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
      document.addEventListener('keydown', handleScreenshotAttempt);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('keydown', handleScreenshotAttempt);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [screenshotProtection]);

  const handleScreenshotAttempt = (e: KeyboardEvent) => {
    // Блокируем PrintScreen и комбинации для скриншотов
    if (e.key === 'PrintScreen' || (e.ctrlKey && e.shiftKey && e.key === 'S')) {
      e.preventDefault();
      alert('Скриншоты запрещены в секретных чатах');
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden && screenshotProtection) {
      // При скрытии окна можно показать предупреждение
      console.warn('Окно скрыто - возможна попытка скриншота');
    }
  };

  useEffect(() => {
    initSecretChat();
  }, [peerUser.id]);

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

      // Выводим общий ключ
      const key = await deriveSharedKey(peerKey.publicKeyJwk);
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

  const verifyKey = async () => {
    // В реальности здесь должна быть проверка отпечатков ключей
    const confirmed = confirm('Проверьте отпечатки ключей с собеседником. Совпадают?');
    setKeyVerified(confirmed);
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




