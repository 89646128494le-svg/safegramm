import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api'; // <--- ИМПОРТИРУЕМ API HELPER

const QUICK_PROMPTS = [
  'Сформируй план на день с приоритетами и дедлайнами.',
  'Подскажи идеи для поста о безопасности в мессенджерах.',
  'Разбери, какие риски есть в текущем коде и как их закрыть.',
  'Составь короткое резюме нашей переписки.'
];

export default function SafetyAssistant({ onClose }) {
  const [mode, setMode] = useState('safety'); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, busy]);

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
      // ИСПОЛЬЗУЕМ api() ВМЕСТО fetch()
      // Это автоматически направит запрос на порт 8080 и добавит токен авторизации
      const data = await api('/api/safety/ask', 'POST', {
        message: text,
        mode: mode
      });

      const reply =
        data.reply ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Модель не вернула текст ответа. Попробуйте уточнить запрос.';
      const actionPerformed = data.actionPerformed || [];
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply },
        ...actionPerformed.map((a) => ({ role: 'system', action: a.name, result: a.result }))
      ]);
    } catch (e) {
      console.error(e);
      // api() выбрасывает ошибку с полем message
      setError(e.message || 'Не удалось связаться с Safety.');
    } finally {
      setBusy(false);
    }
  };

  const speakLast = () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;

    if (speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        return;
    }

    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(last.content);
    utterance.lang = 'ru-RU'; 
    utterance.rate = 1.1;     
    utterance.pitch = mode === 'x' ? 0.8 : 1.0; 

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
          m.role === 'system' ? (
            <div key={idx} className="assistant-msg system-widget">
              <div className="assistant-msg-author">Система</div>
              <div className="assistant-msg-body system-widget-body">
                <span className="system-widget-action">{m.action}</span>
                <span className="system-widget-result">{m.result}</span>
              </div>
            </div>
          ) : (
            <div key={idx} className={`assistant-msg ${m.role}`}>
              <div className="assistant-msg-author">
                {m.role === 'user' ? 'Вы' : (mode === 'x' ? 'Safety-X' : 'Safety')}
              </div>
              <div className="assistant-msg-body" style={{ whiteSpace: 'pre-wrap' }}>
                {m.content}
              </div>
            </div>
          )
        ))}
        
        {busy && (
            <div className="assistant-msg assistant">
                <div className="assistant-msg-author">{mode === 'x' ? 'Safety-X' : 'Safety'}</div>
                <div className="assistant-msg-body flashing">AI печатает...</div>
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
