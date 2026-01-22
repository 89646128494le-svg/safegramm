
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import '../styles/globals.css';

interface LoginProps {
  onDone?: () => void;
}

export default function Login({ onDone }: LoginProps) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { setToken, setUser } = useStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await api('/api/auth/login', 'POST', { username, password });
      console.log('Login response:', res);
      if (res && res.token) {
        setToken(res.token);
        setUser(res.user);
        // Обновляем состояние авторизации перед навигацией
        if (onDone) {
          onDone();
        }
        // Навигация происходит после обновления состояния
        nav('/app/chats');
      } else {
        console.error('No token in response:', res);
        setErr('Токен не получен от сервера');
      }
    } catch (e: any) {
      console.error('Login error:', e);
      setErr(e?.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-lg)',
        background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated background orbs */}
      <motion.div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
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
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(61,216,255,0.3), transparent)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          bottom: '-150px',
          right: '-150px'
        }}
        animate={{
          x: [0, -80, 0],
          y: [0, -50, 0],
          scale: [1, 1.3, 1]
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />

      <motion.div
        className="modal-content"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          maxWidth: '420px',
          width: '100%',
          background: 'rgba(11, 16, 32, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 108, 255, 0.2)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ textAlign: 'center', marginBottom: '32px' }}
        >
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
            <Lock size={32} color="#7c6cff" />
          </motion.div>
          <h2 style={{
            marginBottom: '8px',
            fontSize: '28px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Войти в SafeGram
          </h2>
          <p style={{ color: 'rgba(233, 236, 245, 0.6)', fontSize: '14px' }}>
            Безопасный мессенджер нового поколения
          </p>
        </motion.div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div style={{ position: 'relative' }}>
              <User
                size={18}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(233, 236, 245, 0.5)',
                  pointerEvents: 'none'
                }}
              />
              <input
                placeholder="Логин"
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setU(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 44px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#e9ecf5',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(124, 108, 255, 0.5)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(124, 108, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(233, 236, 245, 0.5)',
                  pointerEvents: 'none'
                }}
              />
              <input
                placeholder="Пароль"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setP(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '14px 44px 14px 44px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#e9ecf5',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(124, 108, 255, 0.5)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(124, 108, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <motion.button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(233, 236, 245, 0.5)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </motion.button>
            </div>
          </motion.div>

          <AnimatePresence>
            {err && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="toast toast-error"
                style={{
                  position: 'relative',
                  top: 0,
                  right: 0,
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

          <motion.button
            type="submit"
            disabled={loading}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -2 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            style={{
              width: '100%',
              padding: '16px',
              background: loading
                ? 'rgba(124, 108, 255, 0.3)'
                : 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#0a0e1a',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: loading
                ? 'none'
                : '0 12px 40px rgba(124,108,255,0.4)',
              transition: 'all 0.3s'
            }}
          >
            {loading ? '⏳ Вход...' : (
              <>
                Войти
                <ArrowRight size={20} />
              </>
            )}
          </motion.button>
        </form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <hr style={{
            margin: '24px 0',
            border: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }} />
          <motion.button
            onClick={() => nav('/register')}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%',
              padding: '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: '#e9ecf5',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Создать аккаунт
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
