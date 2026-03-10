import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarClock, CheckCircle2, CreditCard, ExternalLink, History, Shield, Sparkles, Star } from 'lucide-react';
import Header from '../components/Header';
import { api, getErrorMessage } from '../services/api';
import { useStore } from '../store/useStore';
import { showToast } from '../components/Toast';

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

type PremiumInfo = {
  isPremium: boolean;
  plan: string;
  premiumStatus: string;
  premiumSource?: string;
  premiumExpiresAt?: string | null;
  provider: string;
  checkoutMode: string;
  currentPlanId?: string;
  currentPlan?: PlanItem;
  subscription?: {
    provider?: string;
    status?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
  } | null;
  features?: string[];
  billingUrl?: string;
};

type PaymentHistory = {
  id: string;
  provider: string;
  amountLabel: string;
  status: string;
  planId: string;
  createdAt: string;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString();
}

function statusLabel(status?: string) {
  switch (status) {
    case 'active':
      return 'Активна';
    case 'canceling':
      return 'Отключится в конце периода';
    case 'manual':
      return 'Выдана вручную';
    case 'pending':
      return 'Ожидает подтверждения оплаты';
    case 'free':
      return 'Без подписки';
    default:
      return status || '—';
  }
}

async function openExternalCheckout(url: string) {
  const desktopApi = typeof window !== 'undefined' ? (window as any).electronAPI : null;
  if (desktopApi?.openExternal) {
    await desktopApi.openExternal(url);
    return;
  }
  window.location.href = url;
}

export default function PremiumApply() {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan') || 'premium_monthly';
  const checkoutStatus = searchParams.get('status');
  const navigate = useNavigate();
  const { user, token } = useStore();
  const [premiumInfo, setPremiumInfo] = useState<PremiumInfo | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPlanId, setActionPlanId] = useState('');
  const [renewalBusy, setRenewalBusy] = useState(false);

  const isAuth = !!(token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null));

  const loadBillingState = useCallback(async () => {
    if (!isAuth) return;
    setLoading(true);
    try {
      const [info, historyData, plansData] = await Promise.all([
        api('/api/premium'),
        api('/api/premium/history'),
        api('/api/plans'),
      ]);
      setPremiumInfo(info as PremiumInfo);
      setHistory(Array.isArray(historyData?.payments) ? historyData.payments : []);
      setPlans(Array.isArray(plansData?.plans) ? plansData.plans : []);
    } catch (error) {
      showToast(getErrorMessage(error, 'Не удалось загрузить premium dashboard.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuth]);

  useEffect(() => {
    if (!isAuth) {
      navigate(`/login?redirect=${encodeURIComponent('/premium-apply')}&plan=${encodeURIComponent(requestedPlan)}`);
      return;
    }
    loadBillingState();
  }, [isAuth, loadBillingState, navigate, requestedPlan]);

  useEffect(() => {
    if (!checkoutStatus) return;
    if (checkoutStatus === 'success') {
      showToast('Оформление завершено. Обновляю статус подписки.', 'success');
      loadBillingState();
    }
    if (checkoutStatus === 'cancel') {
      showToast('Оформление отменено.', 'warning');
    }
  }, [checkoutStatus, loadBillingState]);

  const highlightedPlanId = premiumInfo?.currentPlanId || requestedPlan;
  const premiumPlans = useMemo(() => plans.filter((plan) => plan.plan === 'premium'), [plans]);

  const handleCheckout = async (planId: string) => {
    try {
      setActionPlanId(planId);
      const response = await api('/api/premium/checkout', 'POST', {
        planId,
        successUrl: `${window.location.origin}/premium-apply?status=success&plan=${encodeURIComponent(planId)}`,
        cancelUrl: `${window.location.origin}/premium-apply?status=cancel&plan=${encodeURIComponent(planId)}`,
      });

      if (response?.activated) {
        showToast('Premium активирован.', 'success');
        await loadBillingState();
        return;
      }
      if (typeof response?.checkoutUrl === 'string' && response.checkoutUrl.trim()) {
        await openExternalCheckout(response.checkoutUrl.trim());
        return;
      }
      showToast('Не удалось открыть страницу оформления.', 'warning');
    } catch (error) {
      showToast(getErrorMessage(error, 'Не удалось открыть оформление подписки.'), 'error');
    } finally {
      setActionPlanId('');
    }
  };

  const handleRenewalToggle = async (nextAction: 'cancel' | 'resume') => {
    try {
      setRenewalBusy(true);
      await api(`/api/premium/${nextAction}`, 'POST');
      showToast(nextAction === 'cancel' ? 'Автопродление отключено на стороне SafeGram.' : 'Автопродление снова включено.', 'success');
      await loadBillingState();
    } catch (error) {
      showToast(getErrorMessage(error, 'Не удалось обновить настройку продления.'), 'error');
    } finally {
      setRenewalBusy(false);
    }
  };

  if (!isAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, #0a0f1d 0%, #131a2e 100%)' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(124,108,255,0.25)', borderTopColor: '#7c6cff', animation: 'sg-spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top right, rgba(124,108,255,0.16), transparent 28%), linear-gradient(180deg, #070b16 0%, #10172b 60%, #0d1221 100%)',
        color: '#eef2ff',
      }}
    >
      <Header user={user} onLogout={() => {}} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '96px 24px 80px',
          display: 'grid',
          gap: 24,
        }}
      >
        <Link
          to="/pricing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            color: 'rgba(230,236,255,0.78)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={18} />
          Назад к тарифам
        </Link>

        <div
          style={{
            display: 'grid',
            gap: 18,
            padding: 30,
            borderRadius: 28,
            background: 'linear-gradient(180deg, rgba(20, 27, 52, 0.96), rgba(12, 17, 32, 0.96))',
            border: '1px solid rgba(124,108,255,0.18)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.26)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#b6c4ea', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
                <Sparkles size={16} color="#6fc2ff" />
                Premium
              </div>
              <h1 style={{ margin: 0, fontSize: 'clamp(32px, 5vw, 58px)', lineHeight: 0.98, letterSpacing: '-0.04em' }}>
                Управление Premium
              </h1>
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#d7e2ff',
                minWidth: 240,
              }}
            >
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9fb0d7' }}>Статус</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>{loading ? '...' : premiumInfo?.currentPlan?.name || (premiumInfo?.isPremium ? 'Premium' : 'Free')}</div>
              <div style={{ marginTop: 4, color: 'rgba(224,232,255,0.68)' }}>{statusLabel(premiumInfo?.premiumStatus)}</div>
            </div>
          </div>

          <p style={{ margin: 0, maxWidth: 760, fontSize: 17, lineHeight: 1.7, color: 'rgba(224,232,255,0.76)' }}>
            Здесь можно посмотреть статус подписки, срок действия, историю оплат и доступные планы.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          <div style={{ padding: 24, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9fb0d7', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
              <Star size={16} color="#7c6cff" />
              Текущий статус
            </div>
            <div style={{ marginTop: 12, fontSize: 28, fontWeight: 900 }}>
              {loading ? '...' : premiumInfo?.isPremium ? 'Premium' : 'Free'}
            </div>
            <div style={{ marginTop: 8, color: 'rgba(224,232,255,0.72)' }}>{statusLabel(premiumInfo?.premiumStatus)}</div>
          </div>

          <div style={{ padding: 24, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9fb0d7', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
              <CalendarClock size={16} color="#6fc2ff" />
              Действует до
            </div>
            <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800 }}>{loading ? '...' : formatDate(premiumInfo?.premiumExpiresAt)}</div>
            <div style={{ marginTop: 8, color: 'rgba(224,232,255,0.72)' }}>Для ручного плана срок может быть не ограничен.</div>
          </div>

          <div style={{ padding: 24, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9fb0d7', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
              <Shield size={16} color="#7cf2c4" />
              Источник
            </div>
            <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800 }}>{loading ? '...' : premiumInfo?.premiumSource || '—'}</div>
            <div style={{ marginTop: 8, color: 'rgba(224,232,255,0.72)' }}>Здесь отображается источник и срок действия подписки.</div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
            gap: 20,
          }}
        >
          <section
            style={{
              display: 'grid',
              gap: 18,
              padding: 24,
              borderRadius: 28,
              background: 'linear-gradient(180deg, rgba(16, 21, 40, 0.96), rgba(10, 15, 28, 0.96))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9fb0d7' }}>Планы</div>
                <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>Оформление подписки</div>
              </div>
              <div style={{ color: 'rgba(224,232,255,0.62)' }}>{premiumPlans.length} вариантов</div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              {premiumPlans.map((plan) => {
                const highlighted = highlightedPlanId === plan.id;
                const busy = actionPlanId === plan.id;
                return (
                  <motion.div
                    key={plan.id}
                    whileHover={{ y: -4 }}
                    style={{
                      padding: 20,
                      borderRadius: 22,
                      background: highlighted ? 'rgba(124,108,255,0.1)' : 'rgba(255,255,255,0.03)',
                      border: highlighted ? '1px solid rgba(124,108,255,0.38)' : '1px solid rgba(255,255,255,0.08)',
                      display: 'grid',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 24, fontWeight: 900 }}>{plan.name}</div>
                        <div style={{ color: 'rgba(224,232,255,0.72)', lineHeight: 1.6 }}>{plan.description}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#7c6cff' }}>{plan.priceLabel}</div>
                        <div style={{ marginTop: 6, color: 'rgba(224,232,255,0.58)' }}>{plan.period}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {plan.features.map((feature) => (
                        <div key={feature} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'rgba(234,239,255,0.82)' }}>
                          <CheckCircle2 size={16} color="#7cf2c4" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => handleCheckout(plan.id)}
                        disabled={busy}
                        style={{
                          padding: '14px 18px',
                          borderRadius: 16,
                          border: 'none',
                          cursor: busy ? 'default' : 'pointer',
                          fontWeight: 800,
                          background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
                          color: '#08101f',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {busy ? 'Подготовка...' : premiumInfo?.isPremium ? 'Продлить подписку' : 'Купить подписку'}
                      </button>
                      {highlighted ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 16px',
                            borderRadius: 16,
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(224,232,255,0.74)',
                          }}
                        >
                          <Sparkles size={16} color="#f7c55f" />
                          Текущий фокус плана
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gap: 18,
              alignSelf: 'start',
            }}
          >
            <div style={{ padding: 24, borderRadius: 28, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9fb0d7', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
                <CreditCard size={16} color="#6fc2ff" />
                Управление продлением
              </div>
              <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900 }}>
                {premiumInfo?.subscription?.cancelAtPeriodEnd ? 'Продление выключено' : 'Продление активно'}
              </div>
              <div style={{ marginTop: 10, lineHeight: 1.7, color: 'rgba(224,232,255,0.74)' }}>
                Здесь можно включить или отключить продление подписки для этого аккаунта.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
                <button
                  type="button"
                  disabled={renewalBusy}
                  onClick={() => handleRenewalToggle('cancel')}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#eef2ff',
                    cursor: renewalBusy ? 'default' : 'pointer',
                  }}
                >
                  Отключить продление
                </button>
                <button
                  type="button"
                  disabled={renewalBusy}
                  onClick={() => handleRenewalToggle('resume')}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1fc58f 0%, #6fc2ff 100%)',
                    color: '#07101d',
                    fontWeight: 800,
                    cursor: renewalBusy ? 'default' : 'pointer',
                    opacity: renewalBusy ? 0.7 : 1,
                  }}
                >
                  Вернуть продление
                </button>
              </div>
            </div>

            <div style={{ padding: 24, borderRadius: 28, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9fb0d7', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
                <ExternalLink size={16} color="#f7c55f" />
                Дальше
              </div>
              <div style={{ marginTop: 12, lineHeight: 1.7, color: 'rgba(224,232,255,0.74)' }}>
                Если для оформления нужен браузер, SafeGram откроет его автоматически. После возвращения статус подписки обновится.
              </div>
            </div>
          </section>
        </div>

        <section
          style={{
            display: 'grid',
            gap: 18,
            padding: 24,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9fb0d7', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
            <History size={16} color="#6fc2ff" />
            История платежей
          </div>
          {loading ? (
            <div style={{ color: 'rgba(224,232,255,0.6)' }}>Загрузка...</div>
          ) : history.length === 0 ? (
            <div style={{ color: 'rgba(224,232,255,0.68)' }}>Платежей пока нет.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                    gap: 14,
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{item.planId}</div>
                    <div style={{ marginTop: 4, color: 'rgba(224,232,255,0.62)', fontSize: 14 }}>
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800 }}>{item.amountLabel}</div>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      background: item.status === 'succeeded' ? 'rgba(25, 181, 114, 0.16)' : 'rgba(255,255,255,0.06)',
                      color: item.status === 'succeeded' ? '#7cf2c4' : '#dbe6ff',
                      fontSize: 13,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </div>
  );
}
