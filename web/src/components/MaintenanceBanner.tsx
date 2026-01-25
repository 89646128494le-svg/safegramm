import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Clock, Info } from 'lucide-react';
import { api } from '../services/api';

interface MaintenanceData {
  isActive: boolean;
  timestamp?: string;
  message?: string;
  id?: string;
}

export default function MaintenanceBanner() {
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Проверяем статус технических работ
    checkMaintenanceStatus();

    // Проверяем каждые 5 минут
    const interval = setInterval(checkMaintenanceStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const checkMaintenanceStatus = async () => {
    try {
      const response = await api('/api/maintenance/status', 'GET');
      
      if (response.isActive) {
        setMaintenanceData(response);
        
        // Проверяем не был ли баннер уже закрыт для этого ID
        const dismissedId = localStorage.getItem('dismissedMaintenanceId');
        if (dismissedId !== response.id) {
          setIsVisible(true);
          setIsDismissed(false);
        }
      } else {
        setIsVisible(false);
        setMaintenanceData(null);
      }
    } catch (error) {
      console.error('Failed to check maintenance status:', error);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    
    // Сохраняем ID закрытого баннера
    if (maintenanceData?.id) {
      localStorage.setItem('dismissedMaintenanceId', maintenanceData.id);
    }
  };

  if (!isVisible || isDismissed || !maintenanceData) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9998,
          background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
          boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)',
          borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            color: '#1a1f35',
          }}
        >
          {/* Иконка предупреждения */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'rgba(26, 31, 53, 0.1)',
              borderRadius: '50%',
            }}
          >
            <AlertTriangle size={24} strokeWidth={2.5} />
          </motion.div>

          {/* Контент */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
                fontWeight: 700,
                fontSize: '16px',
              }}
            >
              <span>⚠️ Плановые технические работы</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                fontSize: '14px',
                opacity: 0.9,
                flexWrap: 'wrap',
              }}
            >
              {maintenanceData.timestamp && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Clock size={16} />
                  <span>
                    <strong>Время:</strong> {maintenanceData.timestamp}
                  </span>
                </div>
              )}

              {maintenanceData.message && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    flex: 1,
                    minWidth: '200px',
                  }}
                >
                  <Info size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{maintenanceData.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка закрытия */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDismiss}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(26, 31, 53, 0.1)',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(26, 31, 53, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(26, 31, 53, 0.1)';
            }}
          >
            <X size={18} />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
