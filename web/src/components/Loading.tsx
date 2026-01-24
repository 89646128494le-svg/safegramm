import React from 'react';
import { motion } from 'framer-motion';

// Loading Spinner
export function LoadingSpinner({ size = 40, color = '#7c6cff' }: { size?: number; color?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{
        width: size,
        height: size,
        border: `${size / 10}px solid rgba(124, 108, 255, 0.2)`,
        borderTopColor: color,
        borderRadius: '50%'
      }}
    />
  );
}

// Full Page Loading
export function PageLoading({ message = 'Загрузка...' }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)',
        color: '#e2e8f0'
      }}
    >
      <LoadingSpinner size={48} />
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {message}
      </motion.div>
    </motion.div>
  );
}

// Skeleton для сообщений
export function MessageSkeleton() {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '12px',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}>
      {/* Avatar */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)'
      }} />
      
      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Name */}
        <div style={{
          width: '120px',
          height: '14px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.1)'
        }} />
        
        {/* Message lines */}
        <div style={{
          width: '80%',
          height: '16px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.08)'
        }} />
        <div style={{
          width: '60%',
          height: '16px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.08)'
        }} />
      </div>
    </div>
  );
}

// Skeleton для чата в списке
export function ChatSkeleton() {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '12px 16px',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}>
      {/* Avatar */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        flexShrink: 0
      }} />
      
      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        {/* Name */}
        <div style={{
          width: '140px',
          height: '16px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.1)'
        }} />
        
        {/* Last message */}
        <div style={{
          width: '90%',
          height: '14px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.08)'
        }} />
      </div>
      
      {/* Time */}
      <div style={{
        width: '40px',
        height: '12px',
        borderRadius: '4px',
        background: 'rgba(255, 255, 255, 0.08)',
        alignSelf: 'flex-start',
        marginTop: '8px'
      }} />
    </div>
  );
}

// Inline Loading
export function InlineLoading({ text = 'Загрузка...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      color: 'rgba(255, 255, 255, 0.6)'
    }}>
      <LoadingSpinner size={20} />
      <span style={{ fontSize: '14px' }}>{text}</span>
    </div>
  );
}

// Dots Loading Animation
export function DotsLoading() {
  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      alignItems: 'center',
      padding: '8px'
    }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ 
            y: [0, -8, 0],
            opacity: [0.4, 1, 0.4]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.2
          }}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#7c6cff'
          }}
        />
      ))}
    </div>
  );
}

// Button Loading State
export function ButtonLoading({ text = 'Загрузка...', fullWidth = false }: { text?: string; fullWidth?: boolean }) {
  return (
    <button
      disabled
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '12px 24px',
        background: 'rgba(124, 108, 255, 0.5)',
        border: 'none',
        borderRadius: '12px',
        color: '#e2e8f0',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'not-allowed',
        width: fullWidth ? '100%' : 'auto',
        opacity: 0.7
      }}
    >
      <LoadingSpinner size={16} color="#e2e8f0" />
      {text}
    </button>
  );
}

// Skeleton Grid (для списка чатов/серверов)
export function SkeletonGrid({ count = 5, type = 'chat' }: { count?: number; type?: 'chat' | 'message' }) {
  const Component = type === 'chat' ? ChatSkeleton : MessageSkeleton;
  
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </div>
  );
}

// Progress Bar
export function ProgressBar({ progress = 0, showPercentage = true }: { progress: number; showPercentage?: boolean }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        width: '100%',
        height: '8px',
        borderRadius: '4px',
        background: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden'
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #7c6cff 0%, #3dd8ff 100%)',
            borderRadius: '4px'
          }}
        />
      </div>
      {showPercentage && (
        <div style={{
          textAlign: 'right',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.6)',
          marginTop: '4px'
        }}>
          {progress}%
        </div>
      )}
    </div>
  );
}

// Shimmer Effect CSS
const shimmerStyle = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

// Add shimmer styles to document
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = shimmerStyle;
  if (!document.getElementById('loading-styles')) {
    styleTag.id = 'loading-styles';
    document.head.appendChild(styleTag);
  }
}
