'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, getOrCreateDeviceId, setDeviceId } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

function TwoFAForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('tempToken') || '';
  const { setToken, setUser } = useAuthStore();
  const [cloudPassword, setCloudPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) {
      setError('Нет токена. Начните вход с логина и пароля.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await api<{ token?: string; deviceId?: string }>(
        '/api/auth/2fa',
        { method: 'POST', body: JSON.stringify({ tempToken, cloudPassword, deviceId }) }
      );
      if (res.deviceId) setDeviceId(res.deviceId);
      if (res.token) {
        setToken(res.token);
        const user = await api<{ id: string; username: string }>('/api/users/me', { token: res.token });
        setUser(user);
        router.push('/app');
        return;
      }
      setError('Неверный облачный пароль');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass w-full max-w-md p-8 rounded-2xl">
      <Link href="/" className="text-lg font-bold gradient-text block mb-6">SafeGram</Link>
      <h1 className="text-2xl font-bold text-white mb-2">Облачный пароль (2FA)</h1>
      <p className="text-slate-400 text-sm mb-6">Введите облачный пароль для завершения входа.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="Облачный пароль"
          value={cloudPassword}
          onChange={(e) => setCloudPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-premium w-full py-3 disabled:opacity-50">
          {loading ? 'Проверка…' : 'Войти'}
        </button>
      </form>
      <p className="mt-4 text-slate-500 text-sm text-center">
        <Link href="/login" className="text-safegram-accent hover:underline">Назад к входу</Link>
      </p>
    </div>
  );
}

export default function TwoFAPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-slate-400">Загрузка…</div>}>
        <TwoFAForm />
      </Suspense>
    </div>
  );
}
