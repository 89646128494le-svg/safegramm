import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, Star, DollarSign, Info, FileText, Shield, LogIn, UserPlus } from 'lucide-react';

/** Нормальная иконка «три полоски» для мобильного меню */
function BurgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/** Разделы сайта (лендинг) — в выдвижном меню на телефонах */
const publicNavItems = [
  { path: '/', label: 'Главная', icon: Home },
  { path: '/features', label: 'Функции', icon: Star },
  { path: '/pricing', label: 'Тарифы', icon: DollarSign },
  { path: '/about', label: 'О нас', icon: Info },
  { path: '/privacy', label: 'Приватность', icon: Shield },
  { path: '/terms', label: 'Условия', icon: FileText },
];

export default function LandingSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <aside className="landing-sidebar" aria-hidden="true" />
      <button
        type="button"
        className="landing-sidebar-burger"
        aria-label="Открыть меню"
        onClick={() => setOpen(true)}
      >
        <BurgerIcon />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="landing-sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.aside
              className="landing-sidebar-drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.2 }}
              aria-label="Меню"
            >
              <div className="landing-sidebar-drawer-header">
                <span>Меню</span>
                <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>
                  <X size={22} />
                </button>
              </div>
              <div className="landing-sidebar-drawer-items" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                {publicNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="landing-sidebar-item"
                      onClick={() => setOpen(false)}
                      style={isActive ? { color: '#a78bfa', background: 'rgba(124, 108, 255, 0.12)' } : undefined}
                    >
                      <Icon size={22} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                <Link to="/login" className="landing-sidebar-item" onClick={() => setOpen(false)}>
                  <LogIn size={22} />
                  <span>Войти</span>
                </Link>
                <Link to="/register" className="landing-sidebar-item landing-sidebar-item-register" onClick={() => setOpen(false)}>
                  <UserPlus size={22} />
                  <span>Регистрация</span>
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
