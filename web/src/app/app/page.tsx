'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageCircle, LogOut, Send } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCoreBridge } from '@/hooks/useCoreBridge';
import { api } from '@/lib/api';

interface Room {
  id: string;
  name: string;
  type: string;
  memberCount: number;
}

export default function AppPage() {
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const { connected, lastMessage, error, sendMessage } = useCoreBridge(token || null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ text: string; incoming: boolean }[]>([]);
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      router.replace('/login');
      return;
    }
    if (!token) return;
    api<{ rooms: Room[] }>('/api/rooms', { token })
      .then((data) => setRooms(data.rooms || []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [token, router]);

  useEffect(() => {
    if (lastMessage && lastMessage !== lastMessageRef.current) {
      lastMessageRef.current = lastMessage;
      setMessages((m) => [...m, { text: lastMessage, incoming: true }]);
    }
  }, [lastMessage]);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleSend = async () => {
    const t = input.trim();
    if (!t) return;
    setMessages((m) => [...m, { text: t, incoming: false }]);
    setInput('');
    await sendMessage(t);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-safegram-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-safegram-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] flex flex-col">
      <header className="glass border-b border-safegram-border flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-bold gradient-text">SafeGram</span>
          <span className="flex items-center gap-1.5 text-sm">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            {connected ? 'E2EE канал' : 'Подключение…'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">{user.username}</span>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Выйти">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-safegram-border flex flex-col glass">
          <div className="p-4 border-b border-safegram-border">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-safegram-accent" />
              Чаты и комнаты
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <p className="text-slate-500 text-sm p-4">Загрузка…</p>
            ) : rooms.length === 0 ? (
              <p className="text-slate-500 text-sm p-4">Нет комнат.</p>
            ) : (
              rooms.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl hover:bg-white/5 cursor-pointer transition flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-safegram-accent to-safegram-accent2 flex items-center justify-center text-white font-bold">
                    {r.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.type} · {r.memberCount} участ.</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
            {!connected && (
              <div className="glass rounded-xl p-4 text-slate-400 text-sm">
                Установка зашифрованного канала (ECDH + AES-GCM)…
              </div>
            )}
            {error && (
              <div className="rounded-xl p-4 bg-red-500/10 text-red-400 text-sm">{error}</div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.incoming
                    ? 'bg-white/10 text-left self-start'
                    : 'bg-gradient-to-r from-safegram-accent to-safegram-accent2 text-slate-900 font-medium self-end'
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-safegram-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Сообщение (бинарный протокол E2EE)…"
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!connected}
              className="btn-premium py-3 px-5 flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-5 h-5" /> Отправить
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
