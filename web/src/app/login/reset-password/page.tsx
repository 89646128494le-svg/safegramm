'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (newPassword.length < 4) {
      setError('Пароль не менее 4 символов');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      setDone(true);
    } catch (err: unknown) {
      const res = err as { response?: { error?: string; detail?: string } };
      setError(res?.response?.detail || (err instanceof Error ? err.message : 'Ошибка'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] flex items-center justify-center p-6">
        <div className="glass w-full max-w-md p-8 rounded-2xl text-center">
          <Link href="/" className="flex items-center gap-2 justify-center mb-6">
            <img src="/logo.png" alt="SafeGram" className="h-10 w-auto object-contain" />
            <span className="text-lg font-bold gradient-text">SafeGram</span>
          </Link>
          <h1 className="text-xl font-bold text-white mb-2">Пароль изменён</h1>
          <p className="text-slate-400 mb-6">Войдите с новым паролем.</p>
          <Link href="/login" className="btn-premium inline-block w-full py-3 text-center">
            Войти
          </Link>
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
        <h1 className="text-2xl font-bold text-white mb-2">Новый пароль</h1>
        <p className="text-slate-400 text-sm mb-6">Введите email, код из письма и новый пароль.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            required
          />
          <input
            type="text"
            placeholder="Код из письма"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            required
          />
          <input
            type="password"
            placeholder="Новый пароль"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            required
            minLength={4}
          />
          <input
            type="password"
            placeholder="Повторите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-safegram-border text-white placeholder-slate-500 focus:border-safegram-accent outline-none"
            required
            minLength={4}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-premium w-full py-3 disabled:opacity-50">
            {loading ? 'Сохранение…' : 'Сменить пароль'}
          </button>
        </form>
        <p className="mt-4 text-slate-500 text-sm text-center">
          <Link href="/login" className="text-safegram-accent hover:underline">Назад к входу</Link>
        </p>
      </div>
    </div>
  );
}
