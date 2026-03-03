'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmail = emailOrUsername.includes('@');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = isEmail ? { email: emailOrUsername.trim() } : { username: emailOrUsername.trim() };
      await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) });
      setSent(true);
    } catch (err: unknown) {
      const res = err as { response?: { error?: string; detail?: string } };
      const detail = res?.response?.detail || (err instanceof Error ? err.message : 'Ошибка');
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] flex items-center justify-center p-6">
        <div className="glass w-full max-w-md p-8 rounded-2xl text-center">
          <Link href="/" className="flex items-center gap-2 justify-center mb-6">
            <img src="/logo.png" alt="SafeGram" className="h-10 w-auto object-contain" />
            <span className="text-lg font-bold gradient-text">SafeGram</span>
          </Link>
          <h1 className="text-xl font-bold text-white mb-2">Письмо отправлено</h1>
          <p className="text-slate-400 mb-6">
            Если аккаунт с указанными данными существует, на почту пришёл код. Откройте письмо и перейдите по ссылке для сброса пароля или введите код на странице восстановления.
          </p>
          <Link href="/login/reset-password" className="btn-premium inline-block w-full py-3 text-center">
            Ввести код и сменить пароль
          </Link>
          <p className="mt-4 text-slate-500 text-sm">
            <Link href="/login" className="text-safegram-accent hover:underline">Вернуться к входу</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] flex items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8 rounded-2xl">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <img src="/logo.png" alt="SafeGram" className="h-10 w-auto object-contain" />
          <span className="text-lg font-bold gradient-text">SafeGram</span>
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">Восстановление пароля</h1>
        <p className="text-slate-400 text-sm mb-6">Введите email или имя пользователя — отправим код на почту.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Email или имя пользователя"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-premium w-full py-3 disabled:opacity-50">
            {loading ? 'Отправка…' : 'Отправить код'}
          </button>
        </form>
        <p className="mt-4 text-slate-500 text-sm text-center">
          <Link href="/login" className="text-safegram-accent hover:underline">Назад к входу</Link>
        </p>
      </div>
    </div>
  );
}
