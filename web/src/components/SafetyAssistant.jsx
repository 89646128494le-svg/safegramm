import React, { useEffect, useMemo, useRef, useState } from 'react';

// URL нашего API на бэкенде
const API_URL = '/api/safety/ask';

const QUICK_PROMPTS = [
  'Сформируй план на день с приоритетами и дедлайнами.',
  'Подскажи идеи для поста о безопасности в мессенджерах.',
  'Разбери, какие риски есть в текущем коде и как их закрыть.',
  'Составь короткое резюме нашей переписки.'
];

export default function SafetyAssistant({ onClose }) {
  const [mode, setMode] = useState('safety'); // safety | x
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef(null);

  // Авто-прокрутка чата вниз
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // Остановка озвучки при закрытии компонента
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;

    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);

    try {
      // Отправляем запрос на наш Go-сервер
      const rsp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Если ты добавишь авторизацию на сервере, раскомментируй строку ниже:
          // 'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: text,
          mode: mode
        })
      });

      if (!rsp.ok) {
        throw new Error(`Ошибка сервера: ${rsp.status}`);
      }

      const data = await rsp.json();
      const reply = data.reply || 'Молчание... (нет ответа от сервера)';
      
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      console.error(e);
      setError('Не удалось связаться с Safety. Проверь соединение с сервером.');
    } finally {
      setBusy(false);
    }
  };

  const speakLast = () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;

    // Если уже говорит — остановить
    if (speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        return;
    }

    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(last.content);
    
    // Настройки голоса
    utterance.lang = 'ru-RU'; // Русский язык
    utterance.rate = 1.1;     // Скорость чуть быстрее обычной
    utterance.pitch = mode === 'x' ? 0.8 : 1.0; // У Safety-X голос ниже и строже

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
        setSpeaking(false);
        setError('Браузер не смог озвучить текст.');
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="assistant-card">
      <div className="assistant-header">
        <div>
          <div className="assistant-title">
            {mode === 'x' ? 'Safety-X' : 'Safety'} <span style={{fontSize: '0.6em', opacity: 0.7}}>AI</span>
          </div>
          <div className="assistant-subtitle">
            {mode === 'x' ? 'Строгий режим: аудит и риски' : 'Дружелюбный режим: помощь и идеи'}
          </div>
        </div>
        <div className="row">
          <select value={mode} onChange={(e) => setMode(e.target.value === 'x' ? 'x' : 'safety')}>
            <option value="safety">Safety</option>
            <option value="x">Safety-X</option>
          </select>
          {onClose && <button className="ghost" onClick={onClose}>✕</button>}
        </div>
      </div>

      <div className="assistant-quick">
        {QUICK_PROMPTS.map((p) => (
          <button key={p} className="ghost" onClick={() => send(p)} disabled={busy}>
            {p}
          </button>
        ))}
      </div>

      <div ref={logRef} className="assistant-log">
        {messages.map((m, idx) => (
          <div key={idx} className={`assistant-msg ${m.role}`}>
            <div className="assistant-msg-author">
                {m.role === 'user' ? 'Вы' : (mode === 'x' ? 'Safety-X' : 'Safety')}
            </div>
            <div className="assistant-msg-body" style={{ whiteSpace: 'pre-wrap' }}>
                {m.content}
            </div>
          </div>
        ))}
        
        {busy && (
            <div className="assistant-msg assistant">
                <div className="assistant-msg-author">{mode === 'x' ? 'Safety-X' : 'Safety'}</div>
                <div className="assistant-msg-body flashing">Думаю...</div>
            </div>
        )}

        {!messages.length && !busy && (
            <div className="assistant-empty">
                Я готов к работе. Используй Gemini AI для помощи.
            </div>
        )}
      </div>

      {error && <div className="assistant-error">{error}</div>}

      <div className="assistant-input">
        <textarea
          rows={3}
          value={input}
          placeholder={mode === 'x' ? "Запрос на проверку уязвимостей..." : "Спроси меня о чём угодно..."}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="assistant-actions">
          <button 
            className={`ghost ${speaking ? 'active-pulse' : ''}`} 
            onClick={speakLast} 
            disabled={!messages.length}
            title={speaking ? "Остановить" : "Озвучить ответ"}
          >
            {speaking ? '🔇 Стоп' : '🔊 Озвучить'}
          </button>
          <button onClick={() => send()} disabled={busy || !input.trim()}>
            {busy ? '...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}