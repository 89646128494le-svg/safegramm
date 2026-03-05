import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const ringtoneRef = useRef<{ audioContext: AudioContext; oscillator: OscillatorNode; gainNode: GainNode } | null>(null);

  const stopRingtone = useCallback(() => {
    try {
      if (ringtoneRef.current) {
        ringtoneRef.current.oscillator.stop();
        ringtoneRef.current.audioContext.close();
        ringtoneRef.current = null;
      }
    } catch (_) {}
    setIsRinging(false);
  }, []);

  useEffect(() => {
    if (!call) return;

    setIsRinging(true);

    // Каждый раз создаём новый контекст и осциллятор — иначе после первого звонка звук не играет
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      ringtoneRef.current = { audioContext, oscillator, gainNode };
      audioContext.resume().then(() => oscillator.start(0)).catch(() => {});
    } catch (e) {
      console.warn('Ringtone failed:', e);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`Входящий ${call.isVideo ? 'видео' : ''}звонок`, {
          body: `${call.fromName || 'Пользователь'} звонит вам`,
          icon: call.fromAvatar || '/icons/icon-192.png',
          tag: 'incoming-call',
          requireInteraction: true,
        });
      } catch (_) {}
    }

    const timeout = setTimeout(() => {
      stopRingtone();
      if (call) onDecline(call);
    }, 30000);

    return () => {
      clearTimeout(timeout);
      stopRingtone();
    };
  }, [call]);

  useEffect(() => {
    if (!call) stopRingtone();
  }, [call, stopRingtone]);

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
      showToast('Звонок сброшен', 'info');
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
          top: 'max(20px, env(safe-area-inset-top, 20px))',
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

          {/* Заголовок */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(233, 236, 245, 0.8)',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Входящий {call.isVideo ? 'видео' : ''}звонок
            </p>
            <h3 style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              color: '#fff',
            }}>
              {call.fromName || 'Пользователь'}
            </h3>
          </div>

          {/* Подсказка: как принять */}
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'rgba(233, 236, 245, 0.85)',
            textAlign: 'center',
            maxWidth: '320px',
          }}>
            Нажмите зелёную кнопку <strong style={{ color: '#22c55e' }}>«Ответить»</strong>, чтобы принять звонок
          </p>

          {/* Кнопки: сначала Ответить (главная), потом Сбросить */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            maxWidth: '280px',
          }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAccept}
              animate={{
                boxShadow: isRinging
                  ? [
                      '0 4px 16px rgba(34, 197, 94, 0.45)',
                      '0 6px 24px rgba(34, 197, 94, 0.6)',
                      '0 4px 16px rgba(34, 197, 94, 0.45)',
                    ]
                  : '0 4px 16px rgba(34, 197, 94, 0.45)',
              }}
              transition={{ duration: 1, repeat: isRinging ? Infinity : 0 }}
              style={{
                width: '100%',
                padding: '16px 28px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: '14px',
                color: 'white',
                fontSize: '18px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s',
              }}
            >
              <Phone size={22} />
              Ответить
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDecline}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: 'rgba(233, 236, 245, 0.9)',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <PhoneOff size={18} />
              Отклонить
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
