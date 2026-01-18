import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, RefreshCw, Database, Globe, Bot, Server, Activity, CheckCircle, XCircle, Loader } from 'lucide-react';
import { api } from '../services/api';
import { showToast } from './Toast';

interface Service {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'database' | 'telegram' | 'api';
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  url?: string;
  port?: number;
  health?: {
    status: 'healthy' | 'unhealthy';
    lastCheck: number;
    responseTime?: number;
  };
}

const defaultServices: Service[] = [
  {
    id: 'web-app',
    name: 'Веб-приложение',
    description: 'Основное веб-приложение SafeGram на Vercel',
    type: 'web',
    status: 'running',
    url: window.location.origin,
    health: {
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 120
    }
  },
  {
    id: 'api-server',
    name: 'API сервер',
    description: 'Backend API (Go/Node.js)',
    type: 'api',
    status: 'running',
    url: import.meta.env.VITE_API_URL || 'http://localhost:8080',
    port: 8080,
    health: {
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 45
    }
  },
  {
    id: 'database',
    name: 'База данных',
    description: 'PostgreSQL база данных',
    type: 'database',
    status: 'running',
    port: 5432,
    health: {
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 12
    }
  },
  {
    id: 'telegram-bot',
    name: 'Telegram бот',
    description: 'Бот для интеграции с Telegram',
    type: 'telegram',
    status: 'stopped',
    health: {
      status: 'unhealthy',
      lastCheck: Date.now()
    }
  },
  {
    id: 'redis',
    name: 'Redis кэш',
    description: 'Redis для кэширования и онлайн статусов',
    type: 'database',
    status: 'running',
    port: 6379,
    health: {
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 5
    }
  }
];

export default function ServiceManager() {
  const [serviceList, setServiceList] = useState<Service[]>(defaultServices);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadServices();
      }, 10000); // Проверка каждые 10 секунд

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadServices = async () => {
    try {
      const data = await api('/api/admin/services');
      if (data.services && Array.isArray(data.services)) {
        setServiceList(data.services.map((s: any) => ({
          ...s,
          health: s.health ? {
            ...s.health,
            lastCheck: s.health.lastCheck ? new Date(s.health.lastCheck).getTime() : Date.now()
          } : undefined
        })));
      }
    } catch (e) {
      console.error('Failed to load services:', e);
      // Используем дефолтные сервисы
    }
  };

  const startService = async (serviceId: string) => {
    setLoading(prev => ({ ...prev, [serviceId]: true }));
    try {
      await api(`/api/admin/services/${serviceId}/start`, 'POST');
      showToast(`Запуск сервиса "${serviceList.find(s => s.id === serviceId)?.name}"...`, 'info');
      await loadServices();
    } catch (e: any) {
      showToast(`Ошибка запуска: ${e.message || 'Неизвестная ошибка'}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const stopService = async (serviceId: string) => {
    setLoading(prev => ({ ...prev, [serviceId]: true }));
    try {
      await api(`/api/admin/services/${serviceId}/stop`, 'POST');
      showToast(`Остановка сервиса "${serviceList.find(s => s.id === serviceId)?.name}"...`, 'info');
      await loadServices();
    } catch (e: any) {
      showToast(`Ошибка остановки: ${e.message || 'Неизвестная ошибка'}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const restartService = async (serviceId: string) => {
    await stopService(serviceId);
    setTimeout(() => {
      startService(serviceId);
    }, 2000);
  };

  const getServiceIcon = (type: Service['type']) => {
    switch (type) {
      case 'web':
        return Globe;
      case 'database':
        return Database;
      case 'telegram':
        return Bot;
      case 'api':
        return Server;
      default:
        return Server;
    }
  };

  const getStatusColor = (status: Service['status']) => {
    switch (status) {
      case 'running':
        return '#22c55e';
      case 'stopped':
        return '#ef4444';
      case 'starting':
      case 'stopping':
        return '#f59e0b';
      case 'error':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h3 style={{
            fontSize: '24px',
            fontWeight: 800,
            marginBottom: '8px',
            color: '#e9ecf5'
          }}>
            Управление сервисами
          </h3>
          <p style={{
            fontSize: '14px',
            color: 'rgba(233, 236, 245, 0.6)'
          }}>
            Управление всеми сервисами SafeGram инфраструктуры
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            onClick={() => setAutoRefresh(!autoRefresh)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '10px 16px',
              background: autoRefresh ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${autoRefresh ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '10px',
              color: autoRefresh ? '#86efac' : 'rgba(233, 236, 245, 0.8)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Activity size={16} />
            {autoRefresh ? 'Автообновление: ВКЛ' : 'Автообновление: ВЫКЛ'}
          </motion.button>
          <motion.button
            onClick={loadServices}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, rgba(124,108,255,0.3), rgba(61,216,255,0.3))',
              border: '1px solid rgba(124, 108, 255, 0.5)',
              borderRadius: '10px',
              color: '#7c6cff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={16} />
            Обновить все
          </motion.button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gap: '20px'
      }}>
        {serviceList.map((service) => {
          const Icon = getServiceIcon(service.type);
          const isRunning = service.status === 'running';
          const isLoading = loading[service.id];
          const statusColor = getStatusColor(service.status);

          return (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, scale: 1.01 }}
              style={{
                padding: '24px',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                transition: 'all 0.3s'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: `linear-gradient(135deg, ${statusColor}20, ${statusColor}10)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: statusColor,
                    flexShrink: 0
                  }}>
                    <Icon size={28} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <h4 style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        margin: 0,
                        color: '#e9ecf5'
                      }}>
                        {service.name}
                      </h4>
                      <motion.div
                        animate={{
                          scale: [1, 1.1, 1],
                          opacity: [0.7, 1, 0.7]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: statusColor,
                          boxShadow: `0 0 10px ${statusColor}`
                        }}
                      />
                    </div>
                    <p style={{
                      fontSize: '14px',
                      color: 'rgba(233, 236, 245, 0.6)',
                      marginBottom: '12px'
                    }}>
                      {service.description}
                    </p>
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap',
                      fontSize: '12px',
                      color: 'rgba(233, 236, 245, 0.5)'
                    }}>
                      {service.url && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Globe size={14} />
                          <a
                            href={service.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#7c6cff',
                              textDecoration: 'none'
                            }}
                          >
                            {service.url}
                          </a>
                        </div>
                      )}
                      {service.port && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Server size={14} />
                          <span>Порт: {service.port}</span>
                        </div>
                      )}
                      {service.health && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: service.health.status === 'healthy' ? '#86efac' : '#fca5a5'
                        }}>
                          {service.health.status === 'healthy' ? (
                            <CheckCircle size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          <span>
                            {service.health.status === 'healthy' ? 'Работает' : 'Недоступен'}
                            {service.health.responseTime && ` (${service.health.responseTime}ms)`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexShrink: 0
                }}>
                  {isRunning ? (
                    <>
                      <motion.button
                        onClick={() => restartService(service.id)}
                        disabled={isLoading}
                        whileHover={{ scale: isLoading ? 1 : 1.05 }}
                        whileTap={{ scale: isLoading ? 1 : 0.95 }}
                        style={{
                          padding: '10px 16px',
                          background: 'rgba(251, 191, 36, 0.2)',
                          border: '1px solid rgba(251, 191, 36, 0.4)',
                          borderRadius: '10px',
                          color: '#fde047',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          opacity: isLoading ? 0.5 : 1
                        }}
                      >
                        {isLoading ? (
                          <Loader size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                        Перезапуск
                      </motion.button>
                      <motion.button
                        onClick={() => stopService(service.id)}
                        disabled={isLoading}
                        whileHover={{ scale: isLoading ? 1 : 1.05 }}
                        whileTap={{ scale: isLoading ? 1 : 0.95 }}
                        style={{
                          padding: '10px 16px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '10px',
                          color: '#fca5a5',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          opacity: isLoading ? 0.5 : 1
                        }}
                      >
                        {isLoading ? (
                          <Loader size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Square size={16} />
                        )}
                        Остановить
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      onClick={() => startService(service.id)}
                      disabled={isLoading}
                      whileHover={{ scale: isLoading ? 1 : 1.05 }}
                      whileTap={{ scale: isLoading ? 1 : 0.95 }}
                      style={{
                        padding: '10px 16px',
                        background: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        borderRadius: '10px',
                        color: '#86efac',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: isLoading ? 0.5 : 1
                      }}
                    >
                      {isLoading ? (
                        <Loader size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Play size={16} />
                      )}
                      Запустить
                    </motion.button>
                  )}
                </div>
              </div>

              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '12px',
                fontSize: '12px',
                color: 'rgba(233, 236, 245, 0.5)'
              }}>
                <span>ID: {service.id}</span>
                <span>•</span>
                <span>Тип: {service.type}</span>
                <span>•</span>
                <span style={{
                  color: statusColor,
                  fontWeight: 600
                }}>
                  Статус: {service.status === 'running' ? 'Запущен' :
                           service.status === 'stopped' ? 'Остановлен' :
                           service.status === 'starting' ? 'Запускается...' :
                           service.status === 'stopping' ? 'Останавливается...' :
                           'Ошибка'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
