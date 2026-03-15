import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, RefreshCw, Database, Globe, Bot, Server, Activity, CheckCircle, XCircle, Loader } from 'lucide-react';
import { api, getApiBaseUrl } from '../services/api';
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
    name: 'Ð’ÐµÐ±-Ð¿Ñ€Ð¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ',
    description: 'ÐžÑÐ½Ð¾Ð²Ð½Ð¾Ð¹ Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ñ‹Ð¹ frontend SafeGram',
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
    name: 'API ÑÐµÑ€Ð²ÐµÑ€',
    description: 'Backend API (Go/Node.js)',
    type: 'api',
    status: 'running',
    url: getApiBaseUrl(),
    port: 8080,
    health: {
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 45
    }
  },
  {
    id: 'database',
    name: 'Ð‘Ð°Ð·Ð° Ð´Ð°Ð½Ð½Ñ‹Ñ…',
    description: 'PostgreSQL Ð±Ð°Ð·Ð° Ð´Ð°Ð½Ð½Ñ‹Ñ…',
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
    name: 'Telegram Ð±Ð¾Ñ‚',
    description: 'Ð‘Ð¾Ñ‚ Ð´Ð»Ñ Ð¸Ð½Ñ‚ÐµÐ³Ñ€Ð°Ñ†Ð¸Ð¸ Ñ Telegram',
    type: 'telegram',
    status: 'stopped',
    health: {
      status: 'unhealthy',
      lastCheck: Date.now()
    }
  },
  {
    id: 'redis',
    name: 'Redis ÐºÑÑˆ',
    description: 'Redis Ð´Ð»Ñ ÐºÑÑˆÐ¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ Ð¸ Ð¾Ð½Ð»Ð°Ð¹Ð½ ÑÑ‚Ð°Ñ‚ÑƒÑÐ¾Ð²',
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
      }, 10000); // ÐŸÑ€Ð¾Ð²ÐµÑ€ÐºÐ° ÐºÐ°Ð¶Ð´Ñ‹Ðµ 10 ÑÐµÐºÑƒÐ½Ð´

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
      // Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ Ð´ÐµÑ„Ð¾Ð»Ñ‚Ð½Ñ‹Ðµ ÑÐµÑ€Ð²Ð¸ÑÑ‹
    }
  };

  const startService = async (serviceId: string) => {
    setLoading(prev => ({ ...prev, [serviceId]: true }));
    try {
      await api(`/api/admin/services/${serviceId}/start`, 'POST');
      showToast(`Ð—Ð°Ð¿ÑƒÑÐº ÑÐµÑ€Ð²Ð¸ÑÐ° "${serviceList.find(s => s.id === serviceId)?.name}"...`, 'info');
      await loadServices();
    } catch (e: any) {
      showToast(`ÐžÑˆÐ¸Ð±ÐºÐ° Ð·Ð°Ð¿ÑƒÑÐºÐ°: ${e.message || 'ÐÐµÐ¸Ð·Ð²ÐµÑÑ‚Ð½Ð°Ñ Ð¾ÑˆÐ¸Ð±ÐºÐ°'}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const stopService = async (serviceId: string) => {
    setLoading(prev => ({ ...prev, [serviceId]: true }));
    try {
      await api(`/api/admin/services/${serviceId}/stop`, 'POST');
      showToast(`ÐžÑÑ‚Ð°Ð½Ð¾Ð²ÐºÐ° ÑÐµÑ€Ð²Ð¸ÑÐ° "${serviceList.find(s => s.id === serviceId)?.name}"...`, 'info');
      await loadServices();
    } catch (e: any) {
      showToast(`ÐžÑˆÐ¸Ð±ÐºÐ° Ð¾ÑÑ‚Ð°Ð½Ð¾Ð²ÐºÐ¸: ${e.message || 'ÐÐµÐ¸Ð·Ð²ÐµÑÑ‚Ð½Ð°Ñ Ð¾ÑˆÐ¸Ð±ÐºÐ°'}`, 'error');
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
            Ð£Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ ÑÐµÑ€Ð²Ð¸ÑÐ°Ð¼Ð¸
          </h3>
          <p style={{
            fontSize: '14px',
            color: 'rgba(233, 236, 245, 0.6)'
          }}>
            Ð£Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð²ÑÐµÐ¼Ð¸ ÑÐµÑ€Ð²Ð¸ÑÐ°Ð¼Ð¸ SafeGram Ð¸Ð½Ñ„Ñ€Ð°ÑÑ‚Ñ€ÑƒÐºÑ‚ÑƒÑ€Ñ‹
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
            {autoRefresh ? 'ÐÐ²Ñ‚Ð¾Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ: Ð’ÐšÐ›' : 'ÐÐ²Ñ‚Ð¾Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ: Ð’Ð«ÐšÐ›'}
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
            ÐžÐ±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ Ð²ÑÐµ
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
                          <span>ÐŸÐ¾Ñ€Ñ‚: {service.port}</span>
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
                            {service.health.status === 'healthy' ? 'Ð Ð°Ð±Ð¾Ñ‚Ð°ÐµÑ‚' : 'ÐÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½'}
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
                        ÐŸÐµÑ€ÐµÐ·Ð°Ð¿ÑƒÑÐº
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
                        ÐžÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ
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
                      Ð—Ð°Ð¿ÑƒÑÑ‚Ð¸Ñ‚ÑŒ
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
                <span>â€¢</span>
                <span>Ð¢Ð¸Ð¿: {service.type}</span>
                <span>â€¢</span>
                <span style={{
                  color: statusColor,
                  fontWeight: 600
                }}>
                  Ð¡Ñ‚Ð°Ñ‚ÑƒÑ: {service.status === 'running' ? 'Ð—Ð°Ð¿ÑƒÑ‰ÐµÐ½' :
                           service.status === 'stopped' ? 'ÐžÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½' :
                           service.status === 'starting' ? 'Ð—Ð°Ð¿ÑƒÑÐºÐ°ÐµÑ‚ÑÑ...' :
                           service.status === 'stopping' ? 'ÐžÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÑ‚ÑÑ...' :
                           'ÐžÑˆÐ¸Ð±ÐºÐ°'}
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

