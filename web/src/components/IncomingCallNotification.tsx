import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { showToast } from './Toast';

interface IncomingCall {
  callId: string;
  from: string;
  fromName?: string;
  fromAvatar?: string;
  chatId: string;
  isVideo: boolean;
  offer: any;
  timestamp: number;
}

interface Props {
  call: IncomingCall | null;
  onAccept: (call: IncomingCall) => void;
  onDecline: (call: IncomingCall) => void;
}

export default function IncomingCallNotification({ call, onAccept, onDecline }: Props) {
  const [isRinging, setIsRinging] = useState(false);
  const [audio] = useState(() => {
    // Создаем аудио для рингтона (можно заменить на свой файл)
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    
    // Генерируем простой рингтон через Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 440; // A4 note
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    return { audioContext, oscillator, gainNode };
  });

  useEffect(() => {
    if (call) {
      setIsRinging(true);
      
      // Запускаем рингтон
      try {
        audio.oscillator.start();
        audio.audioContext.resume();
      } catch (e) {
        console.error('Failed to start ringtone:', e);
      }

      // Показываем браузерное уведомление
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Входящий ${call.isVideo ? 'видео' : ''}звонок`, {
          body: `${call.fromName || call.from} звонит вам`,
          icon: call.fromAvatar || '/icons/icon-192.png',
          tag: 'incoming-call',
          requireInteraction: true,
        });
      }

      // Автоматически отклоняем через 30 секунд
      const timeout = setTimeout(() => {
        handleDecline();
      }, 30000);

      return () => {
        clearTimeout(timeout);
        stopRingtone();
      };
    }
  }, [call]);

  const stopRingtone = () => {
    try {
      audio.oscillator.stop();
      audio.audioContext.close();
    } catch (e) {
      // Oscillator уже остановлен
    }
    setIsRinging(false);
  };

  const handleAccept = () => {
    stopRingtone();
    if (call) {
      onAccept(call);
      showToast('Звонок принят', 'success');
    }
  };

  const handleDecline = () => {
    stopRingtone();
    if (call) {
      onDecline(call);
      showToast('Звонок отклонён', 'info');
    }
  };

  if (!call) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: '400px',
          maxWidth: 'calc(100vw - 40px)',
          background: 'linear-gradient(135deg, #1a1f35 0%, #2d3250 100%)',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(124, 108, 255, 0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Анимированная волна */}
        <motion.div
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: 'radial-gradient(circle at 50% 50%, rgba(124, 108, 255, 0.2), transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{
          position: 'relative',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}>
          {/* Аватар звонящего */}
          <motion.div
            animate={{
              scale: isRinging ? [1, 1.05, 1] : 1,
            }}
            transition={{
              duration: 0.6,
              repeat: isRinging ? Infinity : 0,
            }}
            style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid #7c6cff',
              background: call.fromAvatar
                ? `url(${call.fromAvatar}) center/cover`
                : 'linear-gradient(135deg, #7c6cff, #3dd8ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!call.fromAvatar && (
              <User size={40} color="#fff" />
            )}
          </motion.div>

          {/* Информация о звонке */}
          <div style={{
            textAlign: 'center',
            color: '#e9ecf5',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '8px',
            }}>
              {call.fromName || call.from}
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              color: 'rgba(233, 236, 245, 0.7)',
            }}>
              {call.isVideo ? (
                <>
                  <Video size={16} />
                  Входящий видеозвонок
                </>
              ) : (
                <>
                  <Phone size={16} />
                  Входящий звонок
                </>
              )}
            </div>
          </div>

          {/* Кнопки */}
          <div style={{
            display: 'flex',
            gap: '16px',
            width: '100%',
            justifyContent: 'center',
          }}>
            {/* Кнопка "Отклонить" */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDecline}
              style={{
                flex: 1,
                maxWidth: '140px',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.2s',
              }}
            >
              <PhoneOff size={20} />
              Отклонить
            </motion.button>

            {/* Кнопка "Принять" */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAccept}
              animate={{
                boxShadow: isRinging
                  ? [
                      '0 4px 12px rgba(34, 197, 94, 0.4)',
                      '0 4px 20px rgba(34, 197, 94, 0.6)',
                      '0 4px 12px rgba(34, 197, 94, 0.4)',
                    ]
                  : '0 4px 12px rgba(34, 197, 94, 0.4)',
              }}
              transition={{
                duration: 1,
                repeat: isRinging ? Infinity : 0,
              }}
              style={{
                flex: 1,
                maxWidth: '140px',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <Phone size={20} />
              Принять
            </motion.button>
          </div>

          {/* Таймер */}
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 30, ease: 'linear' }}
            style={{
              height: '3px',
              background: 'linear-gradient(90deg, #7c6cff, #3dd8ff)',
              borderRadius: '2px',
              width: '100%',
            }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
