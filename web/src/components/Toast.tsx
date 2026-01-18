import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: {
      icon: CheckCircle,
      bg: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.4)',
      text: '#86efac',
      iconColor: '#22c55e'
    },
    error: {
      icon: XCircle,
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.4)',
      text: '#fca5a5',
      iconColor: '#ef4444'
    },
    warning: {
      icon: AlertTriangle,
      bg: 'rgba(251, 191, 36, 0.15)',
      border: 'rgba(251, 191, 36, 0.4)',
      text: '#fde047',
      iconColor: '#fbbf24'
    },
    info: {
      icon: Info,
      bg: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.4)',
      text: '#93c5fd',
      iconColor: '#3b82f6'
    }
  };

  const { icon: Icon, bg, border, text, iconColor } = config[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 400, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 400, scale: 0.8 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        padding: '14px 18px',
        background: bg,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${border}`,
        borderRadius: '14px',
        color: text,
        fontSize: '14px',
        fontWeight: 500,
        zIndex: 10000,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 0, 0, 0.2)',
        maxWidth: '400px',
        wordBreak: 'break-word',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '280px'
      }}
      whileHover={{ scale: 1.02, x: -4 }}
    >
      <Icon size={20} color={iconColor} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <motion.button
        onClick={onClose}
        whileHover={{ scale: 1.2, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        style={{
          background: 'transparent',
          border: 'none',
          color: text,
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
      >
        <X size={16} />
      </motion.button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type?: 'success' | 'error' | 'warning' | 'info' }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}
    >
      <AnimatePresence>
        {toasts.map((toast, index) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: index * 0.05
            }}
            style={{ pointerEvents: 'auto' }}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => onRemove(toast.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

let toastIdCounter = 0;
const toastListeners = new Set<(toast: { id: string; message: string; type?: 'success' | 'error' | 'warning' | 'info' }) => void>();

export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const id = `toast-${++toastIdCounter}`;
  const toast = { id, message, type };
  toastListeners.forEach(listener => listener(toast));
  return id;
}

export function useToast() {
  const [toasts, setToasts] = React.useState<Array<{ id: string; message: string; type?: 'success' | 'error' | 'warning' | 'info' }>>([]);

  React.useEffect(() => {
    const listener = (toast: { id: string; message: string; type?: 'success' | 'error' | 'warning' | 'info' }) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 4000);
    };
    
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, removeToast };
}
