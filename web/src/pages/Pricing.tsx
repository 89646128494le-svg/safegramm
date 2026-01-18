import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, Star, ArrowRight, Zap, Shield, Crown } from 'lucide-react';
import Header from '../components/Header';
import { useStore } from '../store/useStore';

const plans = [
  {
    name: 'Free',
    price: '0₽',
    period: 'навсегда',
    description: 'Идеально для личного использования',
    icon: Zap,
    color: '#3dd8ff',
    features: [
      'Неограниченные сообщения',
      'Личные чаты',
      'Группы до 100 участников',
      'End-to-End шифрование',
      '2GB хранилища',
      'Базовая поддержка'
    ],
    popular: false
  },
  {
    name: 'Premium',
    price: '299₽',
    period: 'в месяц',
    description: 'Для активных пользователей',
    icon: Star,
    color: '#7c6cff',
    features: [
      'Всё из Free',
      'Группы до 1000 участников',
      '10GB хранилища',
      'Приоритетная поддержка',
      'Кастомизация темы',
      'Расширенные настройки',
      'Ранний доступ к функциям'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'По запросу',
    period: '',
    description: 'Для организаций',
    icon: Crown,
    color: '#fbbf24',
    features: [
      'Всё из Premium',
      'Группы до 10000 участников',
      'Неограниченное хранилище',
      'Собственный сервер',
      '24/7 поддержка',
      'Аудит безопасности',
      'Кастомные интеграции',
      'Dedicated менеджер'
    ],
    popular: false
  }
];

export default function Pricing() {
  const { user } = useStore();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
      color: '#e9ecf5'
    }}>
      <Header user={user} onLogout={() => {}} />
      
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          padding: '120px 24px 80px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 900,
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Тарифы SafeGram
          </h1>
          <p style={{
            fontSize: '20px',
            color: 'rgba(233, 236, 245, 0.7)',
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Выберите план, который подходит именно вам
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          marginBottom: '80px'
        }}>
          {plans.map((plan, idx) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10, scale: 1.02 }}
                style={{
                  position: 'relative',
                  padding: '40px',
                  background: plan.popular
                    ? 'linear-gradient(135deg, rgba(124,108,255,0.15), rgba(61,216,255,0.15))'
                    : 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: plan.popular
                    ? '2px solid rgba(124, 108, 255, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '24px',
                  transition: 'all 0.3s'
                }}
              >
                {plan.popular && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '24px',
                      padding: '6px 16px',
                      background: 'linear-gradient(135deg, #7c6cff, #3dd8ff)',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#0a0e1a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Популярный
                  </motion.div>
                )}

                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: `${plan.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  color: plan.color
                }}>
                  <Icon size={32} />
                </div>

                <h3 style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  marginBottom: '8px',
                  color: '#e9ecf5'
                }}>
                  {plan.name}
                </h3>

                <p style={{
                  fontSize: '14px',
                  color: 'rgba(233, 236, 245, 0.6)',
                  marginBottom: '24px'
                }}>
                  {plan.description}
                </p>

                <div style={{
                  marginBottom: '32px'
                }}>
                  <span style={{
                    fontSize: '48px',
                    fontWeight: 900,
                    background: `linear-gradient(135deg, ${plan.color}, ${plan.color}aa)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span style={{
                      fontSize: '16px',
                      color: 'rgba(233, 236, 245, 0.6)',
                      marginLeft: '8px'
                    }}>
                      / {plan.period}
                    </span>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  marginBottom: '32px'
                }}>
                  {plan.features.map((feature, featureIdx) => (
                    <motion.div
                      key={featureIdx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 + featureIdx * 0.05 }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      <Check size={20} color={plan.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{
                        fontSize: '15px',
                        color: 'rgba(233, 236, 245, 0.8)',
                        lineHeight: '1.5'
                      }}>
                        {feature}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ width: '100%' }}
                >
                  <Link
                    to="/register"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '16px',
                      textAlign: 'center',
                      background: plan.popular
                        ? 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      border: plan.popular ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      color: plan.popular ? '#0a0e1a' : '#e9ecf5',
                      textDecoration: 'none',
                      fontSize: '16px',
                      fontWeight: 700,
                      boxShadow: plan.popular ? '0 12px 40px rgba(124,108,255,0.4)' : 'none',
                      transition: 'all 0.3s'
                    }}
                  >
                    {plan.name === 'Enterprise' ? 'Связаться с нами' : 'Начать'}
                  </Link>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            textAlign: 'center',
            padding: '40px',
            background: 'rgba(124, 108, 255, 0.1)',
            borderRadius: '20px',
            border: '1px solid rgba(124, 108, 255, 0.3)'
          }}
        >
          <Shield size={48} color="#7c6cff" style={{ marginBottom: '20px' }} />
          <h3 style={{
            fontSize: '24px',
            fontWeight: 800,
            marginBottom: '12px',
            color: '#e9ecf5'
          }}>
            Все тарифы включают полную безопасность
          </h3>
          <p style={{
            fontSize: '16px',
            color: 'rgba(233, 236, 245, 0.7)',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            End-to-End шифрование, Zero-Knowledge архитектура и AI SafetyNet доступны во всех планах
          </p>
        </motion.div>
      </motion.section>
    </div>
  );
}
