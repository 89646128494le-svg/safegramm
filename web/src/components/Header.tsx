import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LogOut, User, Settings, Crown, Bell, Menu, X, Home, Star, DollarSign, Info, FileText, Lock } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import Navigation from './Navigation';
import { useStore } from '../store/useStore';
import logoGradientUrl from '../assets/brand/logo-mark-gradient.svg';

const publicNavItems = [
  { path: '/', label: 'Главная', icon: Home },
  { path: '/features', label: 'Функции', icon: Star },
  { path: '/pricing', label: 'Тарифы', icon: DollarSign },
  { path: '/about', label: 'О нас', icon: Info },
  { path: '/privacy', label: 'Приватность', icon: Lock },
  { path: '/terms', label: 'Условия', icon: FileText },
];

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  roles?: string[] | string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPublicNav, setShowPublicNav] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const { ui } = useStore();
  const isAppRoute = location.pathname.startsWith('/app');

  const getUserRoles = (): string[] => {
    if (!user?.roles) return [];
    if (Array.isArray(user.roles)) return user.roles;
    return String(user.roles).split(',').map(r => r.trim()).filter(r => r);
  };

  const roles = getUserRoles();
  const isAdmin = roles.includes('admin') || roles.includes('owner');

  const isLandingRoute = ['/', '/features', '/pricing', '/about', '/privacy', '/terms'].includes(location.pathname);

  return (
    <motion.header
      className="app-header app-header-frameless"
      data-landing={isLandingRoute ? 'true' : undefined}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        background: 'rgba(3, 7, 18, 0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: 'none',
        borderBottom: 'none',
        boxShadow: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <motion.div
        style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
        whileHover={{ scale: 1.02 }}
      >
        <motion.div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
        >
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={logoGradientUrl}
              alt="SafeGram logo"
              width={40}
              height={40}
              style={{
                display: 'block',
                width: 40,
                height: 40,
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 24px rgba(77, 155, 255, 0.24))',
              }}
            />
            <h1 style={{
              fontSize: '22px',
              fontWeight: 900,
              margin: 0,
              background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.5px',
              cursor: 'pointer'
            }}>
              SafeGram
            </h1>
            {typeof window !== 'undefined' && (window as any).electronAPI && (
              <span style={{
                padding: '2px 8px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.5)',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#22c55e'
              }}>Desktop</span>
            )}
          </Link>
        </motion.div>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          style={{
            padding: '4px 10px',
            background: 'rgba(124, 108, 255, 0.15)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#a78bfa'
          }}
        >
          BETA
        </motion.span>
      </motion.div>

      <div className="header-right-section" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {!isAppRoute && !user && (
          <>
            <div className="header-public-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Navigation />
            </div>
            {!isLandingRoute && (
            <button
              type="button"
              className="header-burger"
              aria-label="Меню"
              onClick={() => setShowPublicNav(!showPublicNav)}
              style={{
                display: 'none',
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e9ecf5',
                cursor: 'pointer',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              {showPublicNav ? <X size={22} /> : <Menu size={22} />}
            </button>
            )}
          </>
        )}
        <ThemeSwitcher />
        {ui.stealthMode && (
          <span
            title="Stealth mode включен"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              animation: 'pulse 1.4s infinite',
            }}
          >
            🥷
          </span>
        )}
        
        {user ? (
          <>
            {/* Desktop Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="desktop-menu">
              {isAdmin && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/app/admin"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: 'rgba(124, 108, 255, 0.1)',
                      border: '1px solid rgba(124, 108, 255, 0.3)',
                      borderRadius: '10px',
                      color: '#7c6cff',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(124, 108, 255, 0.2)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 108, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(124, 108, 255, 0.1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Crown size={16} />
                    <span>Панель</span>
                  </Link>
                </motion.div>
              )}
              
              <motion.div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={18} color="rgba(233, 236, 245, 0.8)" />
                <span style={{ fontSize: '14px', color: 'rgba(233, 236, 245, 0.8)' }}>{user.username}</span>
              </motion.div>

              <motion.button
                onClick={onLogout}
                style={{
                  padding: '10px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  color: '#fca5a5',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                whileHover={{
                  scale: 1.05,
                  background: 'rgba(239, 68, 68, 0.2)',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
                whileTap={{ scale: 0.95 }}
              >
                <LogOut size={16} />
                <span>Выйти</span>
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              className="mobile-menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{
                display: 'none',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e9ecf5',
                cursor: 'pointer',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {showMenu ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </>
        ) : (
          <div className="header-public-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/login"
                style={{
                  padding: '10px 16px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#e9ecf5',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Войти
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/register"
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
                  borderRadius: '10px',
                  color: '#0a0e1a',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(124, 108, 255, 0.3)'
                }}
              >
                Регистрация
              </Link>
            </motion.div>
          </div>
        )}
      </div>

      {/* Mobile: публичное меню (страницы сайта + Войти + Регистрация) */}
      <AnimatePresence>
        {showPublicNav && !user && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 999,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onClick={() => setShowPublicNav(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(320px, 85vw)',
                background: 'rgba(11, 16, 32, 0.98)',
                backdropFilter: 'blur(20px)',
                borderLeft: 'none',
                zIndex: 1000,
                padding: '24px 16px',
                paddingTop: 'max(24px, env(safe-area-inset-top))',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflowY: 'auto',
              }}
            >
              {publicNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowPublicNav(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 12,
                      textDecoration: 'none',
                      color: isActive ? '#7c6cff' : '#e9ecf5',
                      background: isActive ? 'rgba(124, 108, 255, 0.15)' : 'transparent',
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
              <Link
                to="/login"
                onClick={() => setShowPublicNav(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 16px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: '#e9ecf5',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Войти
              </Link>
              <Link
                to="/register"
                onClick={() => setShowPublicNav(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 16px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: '#0a0e1a',
                  background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
                  fontSize: 16,
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(124, 108, 255, 0.3)',
                }}
              >
                Регистрация
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Menu (для авторизованных) */}
      <AnimatePresence>
        {showMenu && user && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mobile-menu"
            style={{
              position: 'absolute',
              top: '100%',
              right: '24px',
              marginTop: '8px',
              background: 'rgba(11, 16, 32, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '16px',
              minWidth: '200px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              zIndex: 1000
            }}
          >
            {isAdmin && (
              <motion.div
                whileHover={{ x: 4 }}
                style={{ marginBottom: '8px' }}
              >
                <Link
                  to="/app/admin"
                  onClick={() => setShowMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: '#e9ecf5',
                    background: 'rgba(124, 108, 255, 0.1)'
                  }}
                >
                  <Crown size={18} />
                  <span>Панель управления</span>
                </Link>
              </motion.div>
            )}
            <motion.div
              whileHover={{ x: 4 }}
              style={{ marginBottom: '8px' }}
            >
              <Link
                to="/app/profile"
                onClick={() => setShowMenu(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: '#e9ecf5'
                }}
              >
                <User size={18} />
                <span>Профиль</span>
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ x: 4 }}
              style={{ marginBottom: '8px' }}
            >
              <Link
                to="/app/settings"
                onClick={() => setShowMenu(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: '#e9ecf5'
                }}
              >
                <Settings size={18} />
                <span>Настройки</span>
              </Link>
            </motion.div>
            <motion.button
              onClick={() => {
                onLogout();
                setShowMenu(false);
              }}
              whileHover={{ x: 4 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: 'none',
                color: '#fca5a5',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              <LogOut size={18} />
              <span>Выйти</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .desktop-menu {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
          .header-public-nav {
            display: none !important;
          }
          .header-burger {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .header-burger {
            display: none !important;
          }
          .mobile-menu {
            display: none !important;
          }
        }
      `}</style>
    </motion.header>
  );
}
