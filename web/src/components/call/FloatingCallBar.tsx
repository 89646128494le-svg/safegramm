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
  durationSec?: number;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function FloatingCallBar({
  title,
  isVideo,
  isMuted,
  isVideoEnabled,
  onExpand,
  onHangup,
  avatarUrl,
  durationSec,
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
        gap: 18,
        padding: '14px 22px 14px 18px',
        borderRadius: 22,
        background: 'rgba(15, 20, 35, 0.94)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(124, 108, 255, 0.12)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <button
        type="button"
        onClick={onExpand}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          border: 'none',
          background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
        }}
      >
        {isVideo ? <Video size={24} /> : <Phone size={24} />}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
          {durationSec !== undefined && (
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{formatDuration(durationSec)}</span>
          )}
          {isMuted && <MicOff size={12} />}
          {isVideo && !isVideoEnabled && <VideoOff size={12} />}
          {durationSec === undefined && <span>Звонок идёт</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onExpand}
        title="Развернуть"
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
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
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onHangup}
        title="Завершить"
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          border: 'none',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
        }}
      >
        <Phone size={20} style={{ transform: 'rotate(135deg)' }} />
      </motion.button>
    </motion.div>
  );
}
