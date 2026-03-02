'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getOrCreateDeviceId, setDeviceId } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

type LoginRes = { token?: string; needEmail?: boolean; needSms?: boolean; need2FA?: boolean; tempToken?: string; userId?: string; deviceId?: string };

export default function LoginPage() {
  const router = useRouter();
  const { setToken, setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const deviceId = getOrCreateDeviceId();
    try {
      const res = await api<LoginRes>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, deviceId }),
      });
      if (res.deviceId) setDeviceId(res.deviceId);
      if (res.need2FA && res.tempToken) {
        router.push(`/login/2fa?tempToken=${encodeURIComponent(res.tempToken)}`);
        return;
      }
      if (res.needEmail && res.tempToken) {
        router.push(`/login/verify-email?tempToken=${encodeURIComponent(res.tempToken)}`);
        return;
      }
      if (res.token) {
        setToken(res.token);
        const user = await api<{ id: string; username: string; email?: string }>('/api/users/me', { token: res.token });
        setUser(user);
        router.push('/app');
        return;
      }
      setError('Неожиданный ответ сервера');
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Ошибка входа';
      setError(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] flex items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8 rounded-2xl">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <img src="/logo.png" alt="SafeGram" className="h-10 w-auto object-contain" />
          <span className="text-lg font-bold gradient-text">SafeGram</span>
        </Link>
        <h1 className="text-2xl font-bold text-white mb-6">Вход</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-premium w-full py-3 disabled:opacity-50">
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
        <p className="mt-4 text-slate-400 text-sm text-center">
          Нет аккаунта? <Link href="/register" className="text-safegram-accent hover:underline">Регистрация</Link>
        </p>
      </div>
    </div>
  );
}
