import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Star, DollarSign, Info, FileText, Shield, Lock } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Главная', icon: Home },
  { path: '/features', label: 'Функции', icon: Star },
  { path: '/pricing', label: 'Тарифы', icon: DollarSign },
  { path: '/about', label: 'О нас', icon: Info },
  { path: '/privacy', label: 'Приватность', icon: Shield },
  { path: '/terms', label: 'Условия', icon: FileText }
];

export default function Navigation() {
  const location = useLocation();

  return (
    <nav style={{
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <motion.div
            key={item.path}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
                color: isActive ? '#7c6cff' : 'rgba(233, 236, 245, 0.8)',
                background: isActive ? 'rgba(124, 108, 255, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(124, 108, 255, 0.3)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}
