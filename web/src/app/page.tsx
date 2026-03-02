'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Lock, Zap, MessageCircle, ArrowRight, Sparkles } from 'lucide-react';

const features = [
  { icon: Shield, title: 'End-to-End шифрование', desc: 'Военный уровень криптографии. Только вы и получатель.' },
  { icon: Zap, title: 'Молниеносная скорость', desc: 'Мгновенная доставка и плавный интерфейс.' },
  { icon: MessageCircle, title: 'Safety AI', desc: 'Помощник создан Lev. Код, расписание, безопасность.' },
  { icon: Lock, title: 'Zero-Knowledge', desc: 'Сервер не хранит ключи расшифровки ваших сообщений.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#1a1f35] text-slate-200 overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-safegram-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="SafeGram" className="h-8 w-auto object-contain" />
            <span className="text-xl font-bold gradient-text">SafeGram</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="text-slate-400 hover:text-white transition">Политика</Link>
            <Link href="/login" className="text-slate-300 hover:text-white transition">Вход</Link>
            <Link href="/register" className="btn-premium text-sm py-2 px-5">Регистрация</Link>
          </nav>
        </div>
      </header>

      <main className="pt-28 pb-24 px-6">
        <motion.section
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8" animate={{ opacity: [0.8, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Sparkles className="w-4 h-4 text-safegram-accent" />
            <span className="text-sm">Создан Lev · E2EE · Zero-Knowledge</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">
            <span className="gradient-text">Защищённый мессенджер</span>
            <br />
            для тех, кто ценит приватность
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Безопасные сообщения, Safety AI-помощник, трёхэтапная авторизация. Работает на ПК (Qt), в браузере и скоро на мобильных.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-premium inline-flex items-center gap-2">
              Начать бесплатно <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="glass px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition inline-flex">
              Войти
            </Link>
          </div>
        </motion.section>

        <motion.section
          className="max-w-5xl mx-auto mt-24 grid md:grid-cols-2 gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass p-8 rounded-2xl hover:border-safegram-accent/50 transition"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <f.icon className="w-10 h-10 text-safegram-accent mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </motion.section>

        <section className="max-w-4xl mx-auto mt-24 text-center text-slate-500 text-sm">
          <Link href="/privacy" className="underline hover:text-slate-400">Политика конфиденциальности (Zero-Knowledge)</Link>
          {' · '}
          <span>SafeGram © 2026</span>
        </section>
      </main>
    </div>
  );
}
