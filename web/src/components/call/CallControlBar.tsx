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
      style={{
        width: 52,
        height: 52,
        borderRadius: '50%',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: danger
          ? 'linear-gradient(135deg, #ef4444, #dc2626)'
          : active
          ? 'rgba(255,255,255,0.35)'
          : 'rgba(255,255,255,0.12)',
        color: '#fff',
        boxShadow: danger ? '0 4px 20px rgba(239,68,68,0.4)' : '0 4px 16px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(12px)',
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
        gap: 12,
        padding: '16px 24px',
        borderRadius: 28,
        background: 'rgba(15, 20, 35, 0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
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
                  marginBottom: 12,
                  padding: '10px 14px',
                  borderRadius: 16,
                  background: 'rgba(20, 25, 45, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  maxWidth: 220,
                  justifyContent: 'center',
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
