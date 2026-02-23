import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MicOff, VideoOff, Wifi, WifiOff } from 'lucide-react';

export interface CallParticipantTileProps {
  stream: MediaStream | null;
  displayName: string;
  avatarUrl?: string | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  speakingLevel?: number;
  connectionQuality?: 'good' | 'fair' | 'poor';
  reaction?: string | null;
  isLocal?: boolean;
  isScreenShare?: boolean;
  className?: string;
  videoStyle?: React.CSSProperties;
}

export default function CallParticipantTile({
  stream,
  displayName,
  avatarUrl,
  isMuted = false,
  isVideoOff = false,
  isSpeaking = false,
  speakingLevel = 0,
  connectionQuality,
  reaction,
  isLocal = false,
  isScreenShare = false,
  className = '',
  videoStyle = {},
}: CallParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) {
      v.srcObject = stream;
    } else {
      v.srcObject = null;
    }
  }, [stream]);

  const showVideo = stream && !isVideoOff && stream.getVideoTracks().some(t => t.enabled);

  return (
    <motion.div
      layout
      className={`call-participant-tile ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(15, 20, 35, 0.95)',
        boxShadow: isSpeaking
          ? '0 0 0 3px rgba(34, 197, 94, 0.6), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Video or avatar */}
      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 140, background: '#0a0e18' }}>
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isLocal ? 'scaleX(-1)' : 'none',
              ...videoStyle,
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: avatarUrl
                ? `url(${avatarUrl}) center/cover`
                : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            }}
          >
            <User size={64} color="rgba(255,255,255,0.9)" />
          </div>
        )}

        {/* Speaking ring */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 0.6 + speakingLevel * 0.4,
                scale: 1 + speakingLevel * 0.15,
              }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: 20,
                border: '3px solid rgba(34, 197, 94, 0.8)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* Labels: screen share, name, muted/video off */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '10px 12px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {isScreenShare && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                background: 'rgba(124, 58, 237, 0.9)',
                borderRadius: 6,
                color: '#fff',
                fontWeight: 600,
              }}
            >
              Экран
            </span>
          )}
          <span
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName || 'Участник'}
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {isMuted && <MicOff size={14} color="rgba(255,255,255,0.9)" />}
            {isVideoOff && !isScreenShare && <VideoOff size={14} color="rgba(255,255,255,0.9)" />}
          </span>
        </div>

        {/* Connection quality */}
        {connectionQuality && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '4px 8px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: connectionQuality === 'good' ? '#22c55e' : connectionQuality === 'fair' ? '#eab308' : '#ef4444',
            }}
          >
            {connectionQuality === 'poor' ? <WifiOff size={12} /> : <Wifi size={12} />}
            {connectionQuality === 'good' ? 'Отлично' : connectionQuality === 'fair' ? 'Средне' : 'Плохо'}
          </div>
        )}

        {/* Reaction burst */}
        <AnimatePresence>
          {reaction && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 56,
                lineHeight: 1,
                pointerEvents: 'none',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
              }}
            >
              {reaction}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
