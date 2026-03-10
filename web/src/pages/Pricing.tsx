import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Crown, Shield, Star, Wallet, Zap } from 'lucide-react';
import Header from '../components/Header';
import LandingSidebar from '../components/LandingSidebar';
import { api, getErrorMessage } from '../services/api';
import { useStore } from '../store/useStore';
import { showToast } from '../components/Toast';
import '../styles/landing.css';

type PlanItem = {
  id: string;
  name: string;
  plan: string;
  description: string;
  price: number;
  priceLabel: string;
  period: string;
  billingCycle: string;
  features: string[];
  badge?: string;
  checkoutReady?: boolean;
};

const fallbackPlans: PlanItem[] = [
  {
    id: 'free',
    name: 'Free',
    plan: 'free',
    description: 'Базовый доступ к SafeGram.',
    price: 0,
    priceLabel: '0 ₽',
    period: 'навсегда',
    billingCycle: 'none',
    features: ['Сообщения и DM', 'Сквозное шифрование', 'Базовый поиск', 'Файлы до 100 МБ'],
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    plan: 'premium',
    description: 'Месячная подписка для активного личного использования.',
    price: 29900,
    priceLabel: '299 ₽ / мес',
    period: '30 дней',
    billingCycle: 'monthly',
    badge: 'Рекомендуем',
    checkoutReady: true,
    features: ['Файлы до 2 ГБ', 'Экспорт истории чатов', 'Приоритетная поддержка', 'Все возможности Free'],
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    plan: 'premium',
    description: 'Годовая подписка с лучшей ценой за месяц.',
    price: 299000,
    priceLabel: '2 990 ₽ / год',
    period: '365 дней',
    billingCycle: 'yearly',
    badge: 'Выгодно',
    checkoutReady: true,
    features: ['Все возможности Premium', 'Одна оплата на год', 'Меньшая цена за месяц'],
  },
];

function planIcon(plan: PlanItem) {
  if (plan.id === 'free') return Zap;
  if (plan.billingCycle === 'yearly') return Crown;
  return Star;
}

function planColor(plan: PlanItem) {
  if (plan.id === 'free') return '#3dd8ff';
  if (plan.billingCycle === 'yearly') return '#f7c55f';
  return '#7c6cff';
}

export default function Pricing() {
  const { user, token } = useStore();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanItem[]>(fallbackPlans);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<'test' | 'stripe' | 'yookassa' | string>('test');
  const [checkoutMode, setCheckoutMode] = useState<'instant' | 'redirect' | string>('instant');
  const [currentPlanId, setCurrentPlanId] = useState('free');

  useEffect(() => {
    let mounted = true;
    api('/api/plans')
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data?.plans) && data.plans.length > 0) setPlans(data.plans as PlanItem[]);
        if (typeof data?.provider === 'string') setProvider(data.provider);
        if (typeof data?.checkoutMode === 'string') setCheckoutMode(data.checkoutMode);
      })
      .catch((error) => {
        if (!mounted) return;
        showToast(getErrorMessage(error, 'Не удалось загрузить тарифы. Использую локальный каталог.'), 'warning');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrentPlanId(user?.plan === 'premium' ? 'premium_monthly' : 'free');
      return;
    }
    let mounted = true;
    api('/api/premium')
      .then((data) => {
        if (!mounted) return;
        setCurrentPlanId(typeof data?.currentPlanId === 'string' && data.currentPlanId ? data.currentPlanId : data?.isPremium ? 'premium_monthly' : 'free');
      })
      .catch(() => {
        if (mounted) setCurrentPlanId(user?.plan === 'premium' ? 'premium_monthly' : 'free');
      });
    return () => {
      mounted = false;
    };
  }, [token, user?.plan]);

  const onSelectPlan = (plan: PlanItem) => {
    if (plan.id === 'free') {
      navigate(user ? '/app/chats' : '/register');
      return;
    }
    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent('/premium-apply')}&plan=${encodeURIComponent(plan.id)}`);
      return;
    }
    navigate(`/premium-apply?plan=${encodeURIComponent(plan.id)}`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top left, rgba(124,108,255,0.18), transparent 34%), linear-gradient(180deg, #070b16 0%, #11172a 58%, #0d1120 100%)',
        color: '#eef2ff',
      }}
    >
      <Header user={user} onLogout={() => {}} />
      <LandingSidebar />

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '120px 24px 88px',
        }}
      >
        <div style={{ display: 'grid', gap: 28, marginBottom: 52 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              width: 'fit-content',
              padding: '10px 16px',
              borderRadius: 999,
              background: 'rgba(19, 29, 56, 0.78)',
              border: '1px solid rgba(119, 143, 187, 0.2)',
            }}
          >
            <Wallet size={16} color="#6fc2ff" />
            <span style={{ fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#b7c4e8' }}>
              Premium
            </span>
          </div>

          <div style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(38px, 7vw, 72px)',
                lineHeight: 0.95,
                fontWeight: 900,
                letterSpacing: '-0.04em',
              }}
            >
              Тарифы SafeGram
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(224,232,255,0.74)' }}>
              Выберите подходящий тариф, оформите подписку и управляйте статусом Premium в одном месте.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <Link
              to={token ? '/premium-apply' : '/login?redirect=%2Fpremium-apply'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '15px 22px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
                color: '#08101f',
                textDecoration: 'none',
                fontWeight: 800,
                boxShadow: '0 20px 48px rgba(50, 95, 191, 0.28)',
              }}
            >
              Оформить подписку
              <ArrowRight size={18} />
            </Link>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '15px 18px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(224,232,255,0.82)',
              }}
            >
              <Shield size={18} color="#7cf2c4" />
              {provider === 'test'
                ? 'Сейчас доступно тестовое оформление подписки.'
                : 'Оформление подписки откроется по кнопке.'}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
            alignItems: 'stretch',
          }}
        >
          {plans.map((plan, index) => {
            const Icon = planIcon(plan);
            const color = planColor(plan);
            const isPremium = plan.plan === 'premium';
            const isCurrent = currentPlanId === plan.id || (plan.id === 'free' && !user?.isPremium && currentPlanId === 'free');
            return (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                whileHover={{ y: -8 }}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gap: 24,
                  padding: 28,
                  borderRadius: 28,
                  background: isPremium
                    ? 'linear-gradient(180deg, rgba(22, 28, 52, 0.96), rgba(12, 17, 35, 0.96))'
                    : 'linear-gradient(180deg, rgba(14, 19, 35, 0.96), rgba(10, 14, 27, 0.96))',
                  border: isCurrent
                    ? `1px solid ${color}`
                    : `1px solid ${isPremium ? 'rgba(124,108,255,0.28)' : 'rgba(91,111,146,0.22)'}`,
                  boxShadow: isCurrent
                    ? `0 24px 56px ${color}22`
                    : '0 16px 40px rgba(0, 0, 0, 0.22)',
                }}
              >
                {plan.badge ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 18,
                      right: 18,
                      padding: '8px 12px',
                      borderRadius: 999,
                      background: `${color}1a`,
                      color,
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {plan.badge}
                  </div>
                ) : null}

                <div style={{ display: 'grid', gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `${color}18`,
                      color,
                    }}
                  >
                    <Icon size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em' }}>{plan.name}</div>
                    <div style={{ marginTop: 8, color: 'rgba(224,232,255,0.7)', lineHeight: 1.6 }}>{plan.description}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color }}>{plan.priceLabel}</div>
                  <div style={{ color: 'rgba(196,206,231,0.62)' }}>{plan.period}</div>
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                  {plan.features.map((feature) => (
                    <div key={feature} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Check size={18} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(232,238,255,0.82)', lineHeight: 1.55 }}>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPlan(plan)}
                  style={{
                    width: '100%',
                    padding: '16px 18px',
                    borderRadius: 16,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 800,
                    background: isCurrent
                      ? 'rgba(255,255,255,0.08)'
                      : isPremium
                      ? `linear-gradient(135deg, ${color} 0%, #6fc2ff 100%)`
                      : 'rgba(255,255,255,0.08)',
                    color: isCurrent ? '#eef2ff' : isPremium ? '#08101f' : '#eef2ff',
                  }}
                >
                  {isCurrent ? 'Текущий план' : plan.id === 'free' ? 'Начать бесплатно' : token ? 'Оформить подписку' : 'Войти и оформить'}
                </button>
              </motion.article>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 32,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          <div
            style={{
              padding: 22,
              borderRadius: 22,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9fb0d7' }}>Срок действия</div>
            <div style={{ marginTop: 10, fontSize: 17, lineHeight: 1.65, color: 'rgba(238,242,255,0.78)' }}>
              Статус Premium, срок действия и история оплат собраны в одном месте.
            </div>
          </div>
          <div
            style={{
              padding: 22,
              borderRadius: 22,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9fb0d7' }}>Единый статус</div>
            <div style={{ marginTop: 10, fontSize: 17, lineHeight: 1.65, color: 'rgba(238,242,255,0.78)' }}>
              После активации подписка сразу отображается в аккаунте.
            </div>
          </div>
          <div
            style={{
              padding: 22,
              borderRadius: 22,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9fb0d7' }}>Статус каталога</div>
            <div style={{ marginTop: 10, fontSize: 17, lineHeight: 1.65, color: 'rgba(238,242,255,0.78)' }}>
              {loading ? 'Каталог обновляется...' : 'Планы загружены.'}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
