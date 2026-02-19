'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, getOrCreateDeviceId, setDeviceId } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('tempToken') || '';
  const { setToken, setUser } = useAuthStore();
  const [code, setCode] = useState('');
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
      const res = await api<{ token?: string; need2FA?: boolean; tempToken?: string; deviceId?: string }>(
        '/api/auth/verify-email',
        { method: 'POST', body: JSON.stringify({ tempToken, code: code.trim(), deviceId }) }
      );
      if (res.deviceId) setDeviceId(res.deviceId);
      if (res.need2FA && res.tempToken) {
        router.push(`/login/2fa?tempToken=${encodeURIComponent(res.tempToken)}`);
        return;
      }
      if (res.token) {
        setToken(res.token);
        const user = await api<{ id: string; username: string }>('/api/users/me', { token: res.token });
        setUser(user);
        router.push('/app');
        return;
      }
      setError('Неверный или истёкший код');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass w-full max-w-md p-8 rounded-2xl">
      <Link href="/" className="text-lg font-bold gradient-text block mb-6">SafeGram</Link>
      <h1 className="text-2xl font-bold text-white mb-2">Код из Email</h1>
      <p className="text-slate-400 text-sm mb-6">Введите код, отправленный на вашу почту.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Код"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-premium w-full py-3 disabled:opacity-50">
          {loading ? 'Проверка…' : 'Подтвердить'}
        </button>
      </form>
      <p className="mt-4 text-slate-500 text-sm text-center">
        <Link href="/login" className="text-safegram-accent hover:underline">Назад к входу</Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-slate-400">Загрузка…</div>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
