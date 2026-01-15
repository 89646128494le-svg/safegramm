import React, { useEffect, useMemo, useRef, useState } from 'react';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const TTS_URL = 'https://api.openai.com/v1/audio/speech';
const MODEL = 'gpt-4o-mini';
const TTS_MODEL = 'gpt-4o-mini-tts';

const QUICK_PROMPTS = [
  'Сформируй план на день с приоритетами и дедлайнами.',
  'Подскажи идеи для поста о безопасности в мессенджерах.',
  'Разбери, какие риски есть в текущем коде и как их закрыть.',
  'Составь короткое резюме нашей переписки.'
];

function useStoredState(key, initial = '') {
  const [value, setValue] = useState(() => localStorage.getItem(key) || initial);
  useEffect(() => {
    if (value === undefined || value === null) return;
    localStorage.setItem(key, value);
  }, [key, value]);
  return [value, setValue];
}

export default function SafetyAssistant({ onClose }) {
  const [mode, setMode] = useState('safety'); // safety | x
  const [apiKey, setApiKey] = useStoredState('safety_openai_key', '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef(null);

  const systemPrompt = useMemo(() => {
    if (mode === 'x') {
      return [
        'You are Safety-X, the high-security AI sentinel of SafeGram.',
        'You speak in short, confident, technical Russian phrases.',
        'Focus on system analysis, security, risk mitigation, and robustness.',
        'Never help with anything illegal or unsafe; explain the risk instead.'
      ].join(' ');
    }
    return [
      'You are Safety, a friendly AI assistant inside SafeGram.',
      'You answer in concise, clear Russian unless asked otherwise.',
      'You help with productivity, coding, safe growth ideas, and everyday questions.',
      'Never support illegal or unsafe actions; explain why they are unsafe.'
    ].join(' ');
  }, [mode]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    if (!apiKey) {
      setError('Добавьте OpenAI API key, чтобы использовать ассистента.');
      return;
    }
    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);

    const payload = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-8),
        { role: 'user', content: text }
      ],
      temperature: mode === 'x' ? 0.2 : 0.5,
      max_tokens: 500
    };

    try {
      const rsp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (!rsp.ok) {
        const txt = await rsp.text();
        throw new Error(`OpenAI ${rsp.status}: ${txt}`);
      }
      const data = await rsp.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() || 'Нет ответа.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message || 'Не удалось запросить OpenAI.');
    } finally {
      setBusy(false);
    }
  };

  const speakLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last || !apiKey) {
      setError('Нет ответа или отсутствует API key.');
      return;
    }
    setSpeaking(true);
    setError('');
    try {
      const rsp = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: mode === 'x' ? 'onyx' : 'alloy',
          input: last.content
        })
      });
      if (!rsp.ok) {
        const txt = await rsp.text();
        throw new Error(`TTS ${rsp.status}: ${txt}`);
      }
      const buffer = await rsp.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/mpeg' }));
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      setError(e.message || 'Не удалось озвучить ответ.');
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <div className="assistant-card">
      <div className="assistant-header">
        <div>
          <div className="assistant-title">{mode === 'x' ? 'Safety-X' : 'Safety'} Assistant</div>
          <div className="assistant-subtitle">
            {mode === 'x' ? 'Строгий режим: аудит и риски' : 'Дружелюбный режим: помощь и идеи'}
          </div>
        </div>
        <div className="row">
          <select value={mode} onChange={(e) => setMode(e.target.value === 'x' ? 'x' : 'safety')}>
            <option value="safety">Safety</option>
            <option value="x">Safety-X</option>
          </select>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="OpenAI API key (sk-...)"
          />
          <button className="ghost" onClick={() => setApiKey(apiKey.trim())}>Save</button>
          {onClose && <button className="ghost" onClick={onClose}>Close</button>}
        </div>
      </div>

      <div className="assistant-quick">
        {QUICK_PROMPTS.map((p) => (
          <button key={p} className="ghost" onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </div>

      <div ref={logRef} className="assistant-log">
        {messages.map((m, idx) => (
          <div key={idx} className={`assistant-msg ${m.role}`}>
            <div className="assistant-msg-author">{m.role === 'user' ? 'Вы' : (mode === 'x' ? 'Safety-X' : 'Safety')}</div>
            <div className="assistant-msg-body">{m.content}</div>
          </div>
        ))}
        {!messages.length && <div className="assistant-empty">Начните диалог или выберите быстрый промпт.</div>}
      </div>

      {error && <div className="assistant-error">{error}</div>}

      <div className="assistant-input">
        <textarea
          rows={3}
          value={input}
          placeholder="Спросите ассистента..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="assistant-actions">
          <button className="ghost" onClick={speakLast} disabled={speaking || !messages.length}>Озвучить</button>
          <button onClick={() => send()} disabled={busy}>{busy ? '...' : 'Отправить'}</button>
        </div>
      </div>
    </div>
  );
}
