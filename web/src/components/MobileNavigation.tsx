import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Users, Settings, Bookmark, Phone } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

interface Props {
  unreadCount?: number;
  missedCallsCount?: number;
}

export default function MobileNavigation({ unreadCount = 0, missedCallsCount = 0 }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Показываем навигацию только на мобильных устройствах
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  if (!isMobile) return null;
  
  const navItems: NavItem[] = [
    {
      id: 'chats',
      label: 'Чаты',
      icon: <MessageCircle size={24} />,
      path: '/app/chats',
      badge: unreadCount
    },
    {
      id: 'calls',
      label: 'Звонки',
      icon: <Phone size={24} />,
      path: '/app/calls',
      badge: missedCallsCount
    },
    {
      id: 'contacts',
      label: 'Контакты',
      icon: <Users size={24} />,
      path: '/app/contacts'
    },
    {
      id: 'saved',
      label: 'Избранное',
      icon: <Bookmark size={24} />,
      path: '/app/saved'
    },
    {
      id: 'settings',
      label: 'Настройки',
      icon: <Settings size={24} />,
      path: '/app/settings'
    }
  ];
  
  const isActive = (path: string) => location.pathname.startsWith(path);
  
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60px',
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'rgba(26, 31, 53, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 100
    }}>
      {navItems.map((item) => {
        const active = isActive(item.path);
        
        return (
          <motion.button
            key={item.id}
            onClick={() => navigate(item.path)}
            whileTap={{ scale: 0.9 }}
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px',
              background: 'none',
              border: 'none',
              color: active ? '#7c6cff' : 'rgba(233, 236, 245, 0.6)',
              fontSize: '11px',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'color 0.2s',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <div style={{ position: 'relative' }}>
              {item.icon}
              
              {/* Badge для непрочитанных */}
              {item.badge !== undefined && item.badge > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 4px',
                    background: '#ef4444',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'white',
                    border: '2px solid rgba(26, 31, 53, 0.95)'
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </motion.div>
              )}
            </div>
            
            <span>{item.label}</span>
            
            {/* Active indicator */}
            {active && (
              <motion.div
                layoutId="activeTab"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px',
                  height: '3px',
                  background: '#7c6cff',
                  borderRadius: '0 0 3px 3px'
                }}
              />
            )}
          </motion.button>
        );
      })}
    </nav>
  );
}

// Hook для использования в компонентах
export function useMobileNavigation() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return { isMobile };
}
