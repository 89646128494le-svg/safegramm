import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, Cloud, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import '../styles/register.css';

interface FormData {
  username: string;
  email: string;
  password: string;
  needsCloudCode: boolean;
  emailCode: string;
  emailVerified: boolean;
  acceptedTerms: boolean;
}

const steps = [
  { num: 1, title: 'Логин', icon: User },
  { num: 2, title: 'Email', icon: Mail },
  { num: 3, title: 'Пароль', icon: Lock },
  { num: 4, title: 'Облачный код', icon: Cloud },
  { num: 5, title: 'Подтверждение', icon: CheckCircle }
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    needsCloudCode: false,
    emailCode: '',
    emailVerified: false,
    acceptedTerms: false
  });
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const nav = useNavigate();
  const { setToken, setUser } = useStore();

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErr('');
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (!formData.username.trim()) {
          setErr('Введите логин');
          return false;
        }
        if (formData.username.length < 3) {
          setErr('Логин должен содержать минимум 3 символа');
          return false;
        }
        break;
      case 2:
        if (!formData.email.trim()) {
          setErr('Введите email');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setErr('Введите корректный email');
          return false;
        }
        break;
      case 3:
        if (!formData.password.trim()) {
          setErr('Введите пароль');
          return false;
        }
        if (formData.password.length < 4) {
          setErr('Пароль должен содержать минимум 4 символа');
          return false;
        }
        break;
      case 5:
        if (formData.needsCloudCode && !formData.emailCode.trim()) {
          setErr('Введите код с почты');
          return false;
        }
        if (!formData.acceptedTerms) {
          setErr('Необходимо принять пользовательское соглашение');
          return false;
        }
        break;
    }
    return true;
  };

  const sendEmailCode = async () => {
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErr('Введите корректный email');
      return;
    }
    
    setSendingCode(true);
    setErr('');
    
    try {
      await api('/api/auth/send-email-code', 'POST', { email: formData.email });
      setEmailCodeSent(true);
      setErr('');
    } catch (e: any) {
      setErr(e?.message || 'Ошибка отправки кода');
    } finally {
      setSendingCode(false);
    }
  };

  const verifyEmailCode = async () => {
    if (!formData.emailCode.trim()) {
      setErr('Введите код');
      return false;
    }
    
    setLoading(true);
    setErr('');
    
    try {
      const res = await api('/api/auth/verify-email', 'POST', { 
        email: formData.email,
        code: formData.emailCode 
      });
      
      if (res.ok) {
        updateField('emailVerified', true);
        setLoading(false);
        return true;
      } else {
        setErr('Неверный код');
        setLoading(false);
        return false;
      }
    } catch (e: any) {
      setErr(e?.message || 'Ошибка проверки кода');
      setLoading(false);
      return false;
    }
  };

  const nextStep = async () => {
    if (validateStep()) {
      // При переходе на шаг 2 (email) отправляем код
      if (step === 1) {
        setStep(2);
        // Автоматически отправляем код при переходе на шаг email
        setTimeout(() => {
          sendEmailCode();
        }, 300);
      }
      // При переходе на шаг 5 (код) проверяем код
      else if (step === 4 && formData.needsCloudCode) {
        const verified = await verifyEmailCode();
        if (verified) {
          setStep(5);
        }
      }
      // Если не нужен облачный код, переходим к финальному шагу
      else if (step === 4 && !formData.needsCloudCode) {
        setStep(5);
      }
      // Обычный переход на следующий шаг
      else {
        setStep(prev => Math.min(prev + 1, 5));
        setErr('');
      }
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
    setErr('');
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setLoading(true);
    setErr('');
    
    try {
      const res = await api('/api/auth/register', 'POST', { 
        username: formData.username,
        email: formData.email,
        password: formData.password,
        emailCode: formData.needsCloudCode ? formData.emailCode : undefined,
        needsCloudCode: formData.needsCloudCode
      });
      
      setToken(res.token);
      setUser(res.user);
      // Устанавливаем флаг принятия политик при успешной регистрации
      localStorage.setItem('policiesAccepted', '1');
      
      setShowSuccess(true);
      
      setTimeout(() => {
        nav('/app/chats');
      }, 4000);
    } catch (e: any) {
      setErr(e?.message || 'Ошибка регистрации');
      setLoading(false);
    }
  };

  if (showSuccess) {
    return <SuccessAnimation />;
  }

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  const stepVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated background */}
      <motion.div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(124,108,255,0.3), transparent)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          top: '-200px',
          left: '-200px'
        }}
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <motion.div
        className="register-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'rgba(11, 16, 32, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 108, 255, 0.2)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <motion.div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(124,108,255,0.3), rgba(61,216,255,0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <User size={32} color="#7c6cff" />
          </motion.div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 900,
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Регистрация в SafeGram
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.num}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.1, type: "spring", stiffness: 400, damping: 15 }}
                  whileHover={{ scale: 1.1 }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: step >= s.num
                      ? 'linear-gradient(135deg, rgba(124,108,255,0.3), rgba(61,216,255,0.3))'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: step === s.num
                      ? '2px solid rgba(124, 108, 255, 0.5)'
                      : '2px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: step >= s.num ? '#7c6cff' : 'rgba(233, 236, 245, 0.4)',
                    fontSize: '18px',
                    fontWeight: 700,
                    position: 'relative'
                  }}
                >
                  {step > s.num ? (
                    <CheckCircle size={20} />
                  ) : (
                    <Icon size={20} />
                  )}
                  {step === s.num && (
                    <motion.div
                      layoutId="activeStep"
                      style={{
                        position: 'absolute',
                        inset: '-4px',
                        border: '2px solid rgba(124, 108, 255, 0.6)',
                        borderRadius: '14px',
                        boxShadow: '0 0 20px rgba(124, 108, 255, 0.4)'
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {step === 1 && (
              <StepContent
                icon={User}
                title="Создайте логин"
                subtitle="Выберите уникальное имя для вашего аккаунта"
              >
                <input
                  type="text"
                  placeholder="Логин (минимум 3 символа)"
                  value={formData.username}
                  onChange={e => updateField('username', e.target.value)}
                  autoComplete="username"
                  autoFocus
                  className="register-input"
                />
              </StepContent>
            )}

            {step === 2 && (
              <StepContent
                icon={Mail}
                title="Укажите email"
                subtitle="На этот адрес придет код подтверждения"
              >
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={e => {
                    updateField('email', e.target.value);
                    setEmailCodeSent(false);
                    updateField('emailVerified', false);
                  }}
                  autoComplete="email"
                  autoFocus
                  className="register-input"
                  disabled={sendingCode}
                />
                {!emailCodeSent && !sendingCode && (
                  <motion.button
                    onClick={sendEmailCode}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(124, 108, 255, 0.2)',
                      border: '1px solid rgba(124, 108, 255, 0.5)',
                      borderRadius: '12px',
                      color: '#7c6cff',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Отправить код подтверждения
                  </motion.button>
                )}
                {sendingCode && (
                  <div style={{ marginTop: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                    Отправка кода...
                  </div>
                )}
                {emailCodeSent && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      color: '#10b981',
                      fontSize: '13px',
                      textAlign: 'center'
                    }}
                  >
                    ✓ Код отправлен на {formData.email}
                  </motion.div>
                )}
                {formData.emailVerified && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.5)',
                      borderRadius: '12px',
                      color: '#10b981',
                      fontSize: '13px',
                      textAlign: 'center',
                      fontWeight: 600
                    }}
                  >
                    ✓ Email подтвержден
                  </motion.div>
                )}
              </StepContent>
            )}

            {step === 3 && (
              <StepContent
                icon={Lock}
                title="Придумайте пароль"
                subtitle="Минимум 4 символа для безопасности"
              >
                <input
                  type="password"
                  placeholder="Пароль (минимум 4 символа)"
                  value={formData.password}
                  onChange={e => updateField('password', e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  className="register-input"
                />
              </StepContent>
            )}

            {step === 4 && (
              <StepContent
                icon={Cloud}
                title="Нужен облачный код?"
                subtitle="Облачный код обеспечивает дополнительную безопасность"
              >
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <motion.button
                    className={`choice-btn ${formData.needsCloudCode ? 'active' : ''}`}
                    onClick={() => updateField('needsCloudCode', true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: 1,
                      padding: '16px',
                      background: formData.needsCloudCode
                        ? 'linear-gradient(135deg, rgba(124,108,255,0.3), rgba(61,216,255,0.3))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: formData.needsCloudCode
                        ? '2px solid rgba(124, 108, 255, 0.5)'
                        : '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: formData.needsCloudCode ? '#7c6cff' : 'rgba(233, 236, 245, 0.8)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Да, использовать
                  </motion.button>
                  <motion.button
                    className={`choice-btn ${!formData.needsCloudCode ? 'active' : ''}`}
                    onClick={() => updateField('needsCloudCode', false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: 1,
                      padding: '16px',
                      background: !formData.needsCloudCode
                        ? 'linear-gradient(135deg, rgba(124,108,255,0.3), rgba(61,216,255,0.3))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: !formData.needsCloudCode
                        ? '2px solid rgba(124, 108, 255, 0.5)'
                        : '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: !formData.needsCloudCode ? '#7c6cff' : 'rgba(233, 236, 245, 0.8)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Нет, пропустить
                  </motion.button>
                </div>
              </StepContent>
            )}

            {step === 5 && (
              <StepContent
                icon={CheckCircle}
                title={formData.needsCloudCode ? "Введите облачный код" : "Примите соглашение"}
                subtitle={formData.needsCloudCode 
                  ? `Проверьте почту ${formData.email} и введите код`
                  : "Для завершения регистрации необходимо принять пользовательское соглашение"
                }
              >
                {formData.needsCloudCode && (
                  <input
                    type="text"
                    placeholder="Код подтверждения"
                    value={formData.emailCode}
                    onChange={e => updateField('emailCode', e.target.value)}
                    autoFocus
                    maxLength={6}
                    className="register-input"
                    style={{ marginBottom: '20px' }}
                  />
                )}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: 1.6
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.acceptedTerms}
                      onChange={e => updateField('acceptedTerms', e.target.checked)}
                      style={{
                        marginTop: '4px',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#7c6cff'
                      }}
                    />
                    <span>
                      Я принимаю{' '}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#7c6cff', textDecoration: 'underline' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Пользовательское соглашение
                      </a>
                      {' '}и{' '}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#7c6cff', textDecoration: 'underline' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Политику конфиденциальности
                      </a>
                    </span>
                  </label>
                </div>
              </StepContent>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {err && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                color: '#fca5a5',
                fontSize: '14px'
              }}
            >
              {err}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          {step > 1 && (
            <motion.button
              onClick={prevStep}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1,
                padding: '14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#e9ecf5',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: loading ? 0.5 : 1
              }}
            >
              <ArrowLeft size={18} />
              Назад
            </motion.button>
          )}
          <motion.button
            onClick={step === 5 ? handleSubmit : nextStep}
            disabled={loading || sendingCode}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            style={{
              flex: 1,
              padding: '14px',
              background: loading
                ? 'rgba(124, 108, 255, 0.3)'
                : 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#0a0e1a',
              fontSize: '15px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(124, 108, 255, 0.4)'
            }}
          >
            {loading ? (
              '⏳ Загрузка...'
            ) : (
              <>
                {step === 4 || step === 5 ? 'Зарегистрироваться' : 'Далее'}
                <ArrowRight size={18} />
              </>
            )}
          </motion.button>
        </div>

        <motion.div
          style={{
            marginTop: '24px',
            textAlign: 'center'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={() => nav('/login')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(233, 236, 245, 0.6)',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            У меня уже есть аккаунт
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function StepContent({ icon: Icon, title, subtitle, children }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(124,108,255,0.2), rgba(61,216,255,0.2))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#7c6cff'
        }}
      >
        <Icon size={32} />
      </motion.div>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 800,
        textAlign: 'center',
        marginBottom: '8px',
        color: '#e9ecf5'
      }}>
        {title}
      </h2>
      <p style={{
        textAlign: 'center',
        color: 'rgba(233, 236, 245, 0.6)',
        fontSize: '14px',
        marginBottom: '24px'
      }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function SuccessAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)'
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        style={{
          textAlign: 'center',
          color: '#e9ecf5'
        }}
      >
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 20px 60px rgba(124, 108, 255, 0.4)'
          }}
        >
          <CheckCircle size={64} color="#0a0e1a" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontSize: '36px',
            fontWeight: 900,
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Регистрация успешна!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            fontSize: '18px',
            color: 'rgba(233, 236, 245, 0.7)'
          }}
        >
          Добро пожаловать в SafeGram!
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
