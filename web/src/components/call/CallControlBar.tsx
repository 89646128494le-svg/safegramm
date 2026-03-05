import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  MessageCircle,
  Minimize2,
  Maximize2,
  Smile,
  Radio,
  Square,
} from 'lucide-react';

const QUICK_REACTIONS = ['👍', '👎', '😂', '❤️', '👏', '🔥'];

export interface CallControlBarProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  onMuteToggle: () => void;
  onVideoToggle: () => void;
  onScreenShareToggle: () => void;
  onRecordingToggle: () => void;
  onReaction?: (emoji: string) => void;
  onHangup: () => void;
  onMinimize?: () => void;
  onChatToggle?: () => void;
  minimized?: boolean;
  showVideo?: boolean;
  showScreenShare?: boolean;
  showRecording?: boolean;
  showReactions?: boolean;
  showMinimize?: boolean;
  showChat?: boolean;
  className?: string;
}

export default function CallControlBar({
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  isRecording,
  onMuteToggle,
  onVideoToggle,
  onScreenShareToggle,
  onRecordingToggle,
  onReaction,
  onHangup,
  onMinimize,
  onChatToggle,
  minimized = false,
  showVideo = true,
  showScreenShare = true,
  showRecording = true,
  showReactions = true,
  showMinimize = true,
  showChat = false,
  className = '',
}: CallControlBarProps) {
  const [reactionOpen, setReactionOpen] = useState(false);

  const btn = (
    icon: React.ReactNode,
    active: boolean,
    onClick: () => void,
    title: string,
    danger = false
  ) => (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 54,
        height: 54,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: danger
          ? 'linear-gradient(135deg, #ef4444, #dc2626)'
          : active
          ? 'rgba(255,255,255,0.28)'
          : 'rgba(255,255,255,0.1)',
        color: '#fff',
        boxShadow: danger
          ? '0 6px 24px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,255,255,0.15)'
          : active
          ? '0 0 0 2px rgba(124,108,255,0.4), 0 6px 20px rgba(0,0,0,0.25)'
          : '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        border: danger ? 'none' : `1px solid ${active ? 'rgba(124,108,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {icon}
    </motion.button>
  );

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '18px 28px',
        borderRadius: 32,
        background: 'rgba(15, 20, 35, 0.9)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(124,108,255,0.06)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {btn(
        isMuted ? <MicOff size={24} /> : <Mic size={24} />,
        isMuted,
        onMuteToggle,
        isMuted ? 'Включить микрофон (M)' : 'Выключить микрофон (M)'
      )}

      {showVideo &&
        btn(
          isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />,
          !isVideoEnabled,
          onVideoToggle,
          isVideoEnabled ? 'Выключить камеру (V)' : 'Включить камеру (V)'
        )}

      {showScreenShare &&
        btn(
          isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />,
          isScreenSharing,
          onScreenShareToggle,
          isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'
        )}

      {showReactions && onReaction && (
        <div style={{ position: 'relative' }}>
          {btn(
            <Smile size={24} />,
            reactionOpen,
            () => setReactionOpen((o) => !o),
            'Реакция в звонке'
          )}
          <AnimatePresence>
            {reactionOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  padding: '12px 16px',
                  borderRadius: 18,
                  background: 'rgba(18, 22, 40, 0.97)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,108,255,0.08)',
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  maxWidth: 240,
                  justifyContent: 'center',
                  backdropFilter: 'blur(20px)',
                }}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    type="button"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      onReaction(emoji);
                      setReactionOpen(false);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      border: 'none',
                      background: 'rgba(255,255,255,0.08)',
                      fontSize: 22,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showRecording &&
        btn(
          isRecording ? <Square size={20} /> : <Radio size={22} />,
          isRecording,
          onRecordingToggle,
          isRecording ? 'Остановить запись' : 'Начать запись'
        )}

      {showChat && onChatToggle &&
        btn(<MessageCircle size={22} />, false, onChatToggle, 'Чат звонка')}

      {showMinimize && onMinimize &&
        btn(
          minimized ? <Maximize2 size={22} /> : <Minimize2 size={22} />,
          false,
          onMinimize,
          minimized ? 'Развернуть звонок' : 'Свернуть звонок'
        )}

      {btn(<PhoneOff size={24} />, false, onHangup, 'Завершить звонок', true)}
    </div>
  );
}
