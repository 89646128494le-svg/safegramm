import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Users, Settings, Menu, X } from 'lucide-react';

const items = [
  { path: '/app/chats', href: '/login', label: 'Чаты', icon: MessageCircle },
  { path: '/app/contacts', href: '/login', label: 'Контакты', icon: Users },
  { path: '/app/settings', href: '/login', label: 'Настройки', icon: Settings },
];

export default function LandingSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const linkTo = (item: typeof items[0]) => item.path;
  const content = (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={linkTo(item)}
            className="landing-sidebar-item"
            onClick={() => setOpen(false)}
            title={item.label}
          >
            <Icon size={22} />
            <span className="landing-sidebar-label">{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      <aside className="landing-sidebar" aria-label="Навигация приложения">
        {content}
      </aside>
      <button
        type="button"
        className="landing-sidebar-burger"
        aria-label="Открыть меню"
        onClick={() => setOpen(true)}
      >
        <Menu size={24} />
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
              <div className="landing-sidebar-drawer-items">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={linkTo(item)}
                      className="landing-sidebar-item"
                      onClick={() => setOpen(false)}
                    >
                      <Icon size={22} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
