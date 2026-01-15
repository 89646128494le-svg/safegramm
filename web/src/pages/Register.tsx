
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import '../styles/register.css';

interface FormData {
  username: string;
  email: string;
  password: string;
  needsCloudCode: boolean;
  emailCode: string;
}

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    needsCloudCode: false,
    emailCode: ''
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const nav = useNavigate();

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
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      if (step === 4 && !formData.needsCloudCode) {
        // Если не нужен облачный код, пропускаем шаг 5 и сразу регистрируем
        handleSubmit();
      } else {
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
      // Регистрация (email и код будут добавлены в будущем к бэкенду)
      const res = await api('/api/auth/register', 'POST', { 
        username: formData.username, 
        password: formData.password 
      });
      
      localStorage.setItem('token', res.token);
      
      // Показываем анимацию успеха
      setShowSuccess(true);
      
      // После анимации перенаправляем
      setTimeout(() => {
        nav('/app');
      }, 4000);
    } catch (e: any) {
      setErr(e?.message || 'Ошибка регистрации');
      setLoading(false);
    }
  };

  if (showSuccess) {
    return <SuccessAnimation />;
  }

  const steps = [
    { num: 1, title: 'Логин', icon: '👤' },
    { num: 2, title: 'Email', icon: '📧' },
    { num: 3, title: 'Пароль', icon: '🔒' },
    { num: 4, title: 'Облачный код', icon: '☁️' },
    { num: 5, title: 'Подтверждение', icon: '✅' }
  ];

  return (
    <div className="register-container">
      <div className="register-card slide-in">
        <div className="register-header">
          <h1>Регистрация в SafeGram</h1>
          <div className="step-indicator">
            {steps.map((s, idx) => (
              <div key={s.num} className={`step-dot ${step >= s.num ? 'active' : ''} ${step === s.num ? 'current' : ''}`}>
                {step > s.num ? '✓' : s.num}
              </div>
            ))}
          </div>
        </div>

        <div className="register-content fade-in">
          {step === 1 && (
            <div className="step-content">
              <div className="step-icon">👤</div>
              <h2>Создайте логин</h2>
              <p>Выберите уникальное имя для вашего аккаунта</p>
              <input
                type="text"
                placeholder="Логин (минимум 3 символа)"
                value={formData.username}
                onChange={e => updateField('username', e.target.value)}
                className="register-input"
                autoComplete="username"
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="step-content">
              <div className="step-icon">📧</div>
              <h2>Укажите email</h2>
              <p>На этот адрес придет код подтверждения</p>
              <input
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={e => updateField('email', e.target.value)}
                className="register-input"
                autoComplete="email"
                autoFocus
              />
            </div>
          )}

          {step === 3 && (
            <div className="step-content">
              <div className="step-icon">🔒</div>
              <h2>Придумайте пароль</h2>
              <p>Минимум 4 символа для безопасности</p>
              <input
                type="password"
                placeholder="Пароль (минимум 4 символа)"
                value={formData.password}
                onChange={e => updateField('password', e.target.value)}
                className="register-input"
                autoComplete="new-password"
                autoFocus
              />
            </div>
          )}

          {step === 4 && (
            <div className="step-content">
              <div className="step-icon">☁️</div>
              <h2>Нужен облачный код?</h2>
              <p>Облачный код обеспечивает дополнительную безопасность</p>
              <div className="choice-buttons">
                <button
                  className={`choice-btn ${formData.needsCloudCode ? 'active' : ''}`}
                  onClick={() => updateField('needsCloudCode', true)}
                >
                  Да, использовать
                </button>
                <button
                  className={`choice-btn ${!formData.needsCloudCode ? 'active' : ''}`}
                  onClick={() => updateField('needsCloudCode', false)}
                >
                  Нет, пропустить
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="step-content">
              <div className="step-icon">✅</div>
              <h2>Введите код с почты</h2>
              <p>Проверьте почту {formData.email} и введите код</p>
              <input
                type="text"
                placeholder="Код подтверждения"
                value={formData.emailCode}
                onChange={e => updateField('emailCode', e.target.value)}
                className="register-input"
                autoFocus
                maxLength={6}
              />
            </div>
          )}

          {err && <div className="error-message">{err}</div>}

          <div className="register-actions">
            {step > 1 && (
              <button onClick={prevStep} className="btn-secondary" disabled={loading}>
                Назад
              </button>
            )}
            <button 
              onClick={step === 4 || step === 5 ? handleSubmit : nextStep}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Загрузка...' : step === 4 || step === 5 ? 'Зарегистрироваться' : 'Далее'}
            </button>
          </div>

          <div className="register-footer">
            <button onClick={() => nav('/login')} className="link-btn">
              У меня уже есть аккаунт
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessAnimation() {
  return (
    <div className="success-container">
      <div className="success-animation">
        <div className="shield">
          <div className="shield-inner">
            <div className="lock">
              <div className="key-hole"></div>
            </div>
          </div>
        </div>
        <div className="key">
          <div className="key-head"></div>
          <div className="key-shaft"></div>
        </div>
        <div className="gate-left"></div>
        <div className="gate-right"></div>
        <div className="success-text">
          <h1>Регистрация успешно пройдена!</h1>
          <p>Добро пожаловать в защищённый мессенджер!!</p>
        </div>
      </div>
    </div>
  );
}
