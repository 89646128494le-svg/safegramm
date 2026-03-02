'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Lock, Database, Eye } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] text-slate-200">
      <header className="glass border-b border-safegram-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold gradient-text">
          <img src="/logo.png" alt="SafeGram" className="h-8 w-auto object-contain" />
          SafeGram
        </Link>
          <Link href="/" className="text-slate-400 hover:text-white transition">На главную</Link>
        </div>
      </header>

      <motion.main
        className="max-w-3xl mx-auto px-6 py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="glass-strong p-8 md:p-12 rounded-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-10 h-10 text-safegram-accent" />
            <h1 className="text-3xl font-black gradient-text">Политика конфиденциальности</h1>
          </div>
          <p className="text-slate-400 text-sm mb-8">Версия 1.0 · Zero-Knowledge · SafeGram</p>

          <section className="mb-8 p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex gap-4">
              <Lock className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-emerald-400 mb-2">Принцип Zero-Knowledge</h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Мы используем сквозное шифрование (E2EE): обмен ключами — Curve25519, шифрование сообщений — AES-256-GCM. Ключи расшифровки не хранятся на сервере и остаются только на вашем устройстве. Сервер передаёт только зашифрованные данные и не может их прочитать.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-safegram-accent" />
              Какие данные обрабатываются
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-400 text-sm">
              <li>Идентификатор устройства (Device ID) — для привязки сессии и защиты от злоупотреблений.</li>
              <li>IP-адрес — для установления соединения и защиты от атак (Anti-DDoS, Rate Limiting, PoW).</li>
              <li>Публичные ключи (Curve25519) — для согласования сессионного ключа; закрытые ключи и сессионный ключ только на вашем устройстве, на сервере не хранятся.</li>
              <li>Логин/email/телефон — для регистрации и многоэтапной авторизации (пароль → email-код → облачный пароль).</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-safegram-accent" />
              Чего мы не делаем
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Мы не читаем ваши сообщения, не передаём ключи третьим лицам и не используем контент переписки для рекламы или аналитики. Safety AI обрабатывает запросы в рамках сессии; при необходимости история может быть анонимизирована.
            </p>
          </section>

          <p className="text-slate-500 text-xs">
            Контакты и обновления политики — в приложении и на главной странице. SafeGram создан Lev.
          </p>
        </div>
      </motion.main>
    </div>
  );
}
