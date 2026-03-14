import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Clock3, Sparkles } from 'lucide-react';
import { useDomainMigration } from '../contexts/DomainMigrationContext';
import { formatCountdownParts, getMigrationDeadlineLabel } from '../lib/domainMigration';

export default function DomainMigration() {
  const migration = useDomainMigration();
  const countdown = formatCountdownParts(migration.msUntilDeadline);
  const isCountdown = migration.phase === 'countdown';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background:
          'radial-gradient(circle at 20% 20%, rgba(61, 216, 255, 0.12), transparent 32%), radial-gradient(circle at 80% 15%, rgba(124, 108, 255, 0.15), transparent 28%), linear-gradient(180deg, #050816 0%, #0a1020 52%, #070c18 100%)',
        color: '#eef2ff',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{
          width: 'min(100%, 880px)',
          padding: '34px',
          borderRadius: 28,
          background: 'rgba(10, 17, 34, 0.8)',
          border: '1px solid rgba(139, 163, 199, 0.14)',
          boxShadow: '0 28px 80px rgba(2, 8, 23, 0.42)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div style={{ display: 'grid', gap: 22 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              width: 'fit-content',
              padding: '10px 14px',
              borderRadius: 999,
              background: 'rgba(124, 108, 255, 0.14)',
              border: '1px solid rgba(124, 108, 255, 0.24)',
              color: '#cbd5ff',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            <Sparkles size={15} />
            Переезд на safegram.site
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(34px, 6vw, 64px)', lineHeight: 0.95, fontWeight: 900 }}>
              {isCountdown ? 'Вход и регистрация уже закрыты' : 'SafeGram уже переехал'}
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(226, 232, 255, 0.78)', maxWidth: 700 }}>
              {isCountdown
                ? 'До запуска нового адреса остался финальный час. Старый домен больше не принимает новые входы и регистрации, чтобы переезд прошёл без потерь.'
                : 'Спасибо, что были с нами на beta-домене. Основная точка входа теперь — safegram.site. Переходите на новый адрес, там мессенджер уже продолжает работу.'}
            </p>
          </div>

          {isCountdown && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 14,
              }}
            >
              {[
                { label: 'Часы', value: countdown.hours },
                { label: 'Минуты', value: countdown.minutes },
                { label: 'Секунды', value: countdown.seconds },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '18px 16px',
                    borderRadius: 22,
                    background: 'linear-gradient(180deg, rgba(18, 30, 58, 0.95), rgba(10, 16, 32, 0.95))',
                    border: '1px solid rgba(61, 216, 255, 0.16)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ fontSize: 'clamp(28px, 7vw, 52px)', fontWeight: 900, letterSpacing: '0.06em' }}>{item.value}</div>
                  <div style={{ marginTop: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#93c5fd' }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 14,
              color: 'rgba(219, 234, 254, 0.82)',
              fontSize: 14,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Clock3 size={16} />
              Крайняя точка старого адреса: {getMigrationDeadlineLabel()}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <a
              href={migration.targetUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '15px 22px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
                color: '#06101f',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 18px 50px rgba(50, 95, 191, 0.28)',
              }}
            >
              Перейти на safegram.site
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
