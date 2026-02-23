import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Video, Maximize2, Mic, MicOff, VideoOff } from 'lucide-react';

export interface FloatingCallBarProps {
  title: string;
  isVideo: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  onExpand: () => void;
  onHangup: () => void;
  avatarUrl?: string | null;
}

export default function FloatingCallBar({
  title,
  isVideo,
  isMuted,
  isVideoEnabled,
  onExpand,
  onHangup,
  avatarUrl,
}: FloatingCallBarProps) {
  return (
    <motion.div
      layout
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px 12px 16px',
        borderRadius: 20,
        background: 'rgba(15, 20, 35, 0.92)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(124, 108, 255, 0.15)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <button
        type="button"
        onClick={onExpand}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: 'none',
          background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {isVideo ? <Video size={22} /> : <Phone size={22} />}
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          {isMuted && <MicOff size={12} />}
          {isVideo && !isVideoEnabled && <VideoOff size={12} />}
          <span>Звонок идёт</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onExpand}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: 'none',
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Maximize2 size={20} />
      </button>
      <button
        type="button"
        onClick={onHangup}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(239,68,68,0.4)',
        }}
      >
        <Phone size={20} style={{ transform: 'rotate(135deg)' }} />
      </button>
    </motion.div>
  );
}
