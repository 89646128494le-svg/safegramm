import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', text: '#86efac' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#fca5a5' },
    warning: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', text: '#fde047' },
    info: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#93c5fd' }
  };

  const color = colors[type];

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        padding: '12px 16px',
        background: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: 12,
        color: color.text,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 10000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        animation: 'slideIn 0.3s ease-out',
        maxWidth: '400px',
        wordBreak: 'break-word'
      }}
    >
      {message}
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type?: 'success' | 'error' | 'info' | 'warning' }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

let toastIdCounter = 0;
const toastListeners = new Set<(toasts: Array<{ id: string; message: string; type?: 'success' | 'error' | 'info' | 'warning' }>) => void>();
let currentToasts: Array<{ id: string; message: string; type?: 'success' | 'error' | 'info' | 'warning' }> = [];

export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  const id = `toast-${++toastIdCounter}`;
  currentToasts = [...currentToasts, { id, message, type }];
  toastListeners.forEach(listener => listener(currentToasts));
  
  setTimeout(() => {
    currentToasts = currentToasts.filter(t => t.id !== id);
    toastListeners.forEach(listener => listener(currentToasts));
  }, 3000);
}

export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: 'success' | 'error' | 'info' | 'warning' }>>(currentToasts);

  useEffect(() => {
    const listener = (newToasts: typeof currentToasts) => setToasts(newToasts);
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  const removeToast = (id: string) => {
    currentToasts = currentToasts.filter(t => t.id !== id);
    toastListeners.forEach(listener => listener(currentToasts));
  };

  return { toasts, removeToast };
}

