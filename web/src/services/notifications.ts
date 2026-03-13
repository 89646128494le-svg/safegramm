// Сервис для веб-уведомлений со звуком

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
  sound?: string;
  image?: string; // Превью изображения
  actions?: NotificationAction[]; // Действия в уведомлении
  timestamp?: number;
}

function isStealthModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('safegram_stealth_mode') === '1';
}

// Проверка поддержки уведомлений
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

// Запрос разрешения на уведомления
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  
  return Notification.permission;
}

// Проверка разрешения
export function hasNotificationPermission(): boolean {
  return isNotificationSupported() && Notification.permission === 'granted';
}

// Типы звуков уведомлений
export type SoundType = 'default' | 'gentle' | 'classic' | 'modern' | 'soft' | 'alert' | 'bell' | 'chime' | 'pop' | 'ding' | 'whoosh' | 'bubble';

// Типы событий для разных звуков
export type NotificationEventType = 'message' | 'call' | 'mention' | 'group' | 'channel' | 'system';

// Воспроизведение звука уведомления с выбором типа
export function playNotificationSound(volume: number = 0.5, soundType: SoundType = 'default'): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = type;
      
      const vol = volume * 0.15;
      gainNode.gain.setValueAtTime(vol, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const baseTime = audioContext.currentTime;
    
    switch (soundType) {
      case 'gentle':
        // Мягкий звук (низкие тона)
        [600, 700, 800].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.12, 0.2);
        });
        break;
        
      case 'classic':
        // Классический звук (как старые телефоны)
        [800, 1000].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.2, 0.25, 'square');
        });
        break;
        
      case 'modern':
        // Современный звук (быстрые тона)
        [1000, 1200, 1400, 1200].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.08, 0.1);
        });
        break;
        
      case 'soft':
        // Очень мягкий звук
        [500, 600].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.15, 0.3);
        });
        break;
        
      case 'alert':
        // Предупреждающий звук (более громкий)
        [1000, 800, 1000, 800].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.1, 0.15, 'square');
        });
        break;
        
      case 'bell':
        // Звонок колокольчика
        [880, 1100, 1320].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.15, 0.4);
        });
        break;
        
      case 'chime':
        // Мелодичный звон
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.2, 0.3);
        });
        break;
        
      case 'pop':
        // Короткий "поп"
        playTone(800, baseTime, 0.05, 'square');
        break;
        
      case 'ding':
        // Одиночный "динг"
        playTone(1000, baseTime, 0.2);
        break;
        
      case 'whoosh':
        // Звук "свист"
        [400, 600, 800, 1000].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.05, 0.08);
        });
        break;
        
      case 'bubble':
        // Пузырьки
        [600, 800, 1000, 800, 600].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.08, 0.1);
        });
        break;
        
      default: // 'default'
        // Стандартный звук (последовательность тонов)
        [800, 1000, 1200].forEach((freq, i) => {
          playTone(freq, baseTime + i * 0.1, 0.15);
        });
    }
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
}

// Показ веб-уведомления со звуком
export async function showNotification(
  options: NotificationOptions,
  playSound: boolean = true,
  soundVolume: number = 0.5,
  soundType: SoundType = 'default'
): Promise<Notification | null> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return null;
  }
  
  if (!hasNotificationPermission()) {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }
  }
  
  // Воспроизводим звук
  if (playSound) {
    playNotificationSound(soundVolume, soundType);
  }

  const w = typeof window !== 'undefined' ? window : null;
  const electronAPI = w && (w as any).electronAPI;
  if (electronAPI?.showNotification) {
    electronAPI.showNotification({
      title: options.title,
      body: options.body,
      icon: options.icon || undefined,
      silent: options.silent || false,
    }).catch(() => {});
    return null;
  }
  
  // Создаём уведомление
  const notificationOptions: any = {
    icon: options.icon || '/favicon.png',
    badge: options.badge || '/favicon.png',
    tag: options.tag,
    data: options.data,
    requireInteraction: options.requireInteraction || false,
    silent: options.silent || false,
    timestamp: options.timestamp || Date.now(),
  };
  
  // Добавляем изображение если есть (поддерживается в некоторых браузерах)
  if (options.image) {
    notificationOptions.image = options.image;
  }
  
  // Добавляем действия если есть (поддерживается в некоторых браузерах)
  if (options.actions && Array.isArray(options.actions)) {
    notificationOptions.actions = options.actions;
  }
  
  const notification = new Notification(options.title, {
    ...notificationOptions,
    body: options.body,
  });
  
  // Автоматически закрываем через 5 секунд
  setTimeout(() => {
    notification.close();
  }, 5000);
  
  // Обработка клика на уведомление
  // Обработка клика на уведомление
  notification.onclick = () => {
    window.focus();
    notification.close();
    
    // Если есть данные с URL, переходим туда
    if (options.data?.url) {
      window.location.href = options.data.url;
    }
  };
  
  // Обработка действий в уведомлении (если поддерживается)
  if ('addEventListener' in notification) {
    (notification as any).addEventListener('click', (event: any) => {
      const action = event.action;
      if (action === 'reply') {
        // Открываем чат для ответа
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
      } else if (action === 'call') {
        // Инициируем звонок
        if (options.data?.chatId) {
          // Здесь можно вызвать функцию начала звонка
          window.location.href = `${options.data.url}?call=true`;
        }
      } else if (action === 'view') {
        // Просто открываем чат
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
      }
      notification.close();
    });
  }
  
  return notification;
}

// Проверка Do Not Disturb режима
export function isDoNotDisturbActive(dndStart?: string, dndEnd?: string): boolean {
  if (!dndStart || !dndEnd) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = dndStart.split(':').map(Number);
  const [endHour, endMin] = dndEnd.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  // Если время начала больше времени окончания, значит это ночной режим (например, 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  
  return currentTime >= startTime && currentTime < endTime;
}

// Уведомление о новом сообщении
export async function notifyNewMessage(
  senderName: string,
  messageText: string,
  chatName?: string,
  chatId?: string,
  avatarUrl?: string,
  playSound: boolean = true,
  soundVolume: number = 0.5,
  soundType: SoundType = 'default',
  imageUrl?: string,
  isMention?: boolean,
  chatType?: 'dm' | 'group' | 'channel',
  dndStart?: string,
  dndEnd?: string
): Promise<Notification | null> {
  // Проверяем Do Not Disturb
  if (isDoNotDisturbActive(dndStart, dndEnd)) {
    // В режиме DND только упоминания проходят
    if (!isMention) {
      return null;
    }
  }
  
  const stealthMode = isStealthModeEnabled();

  // Обрезаем текст сообщения
  const truncatedText = messageText.length > 100 
    ? messageText.substring(0, 100) + '...' 
    : messageText;
  
  const title = chatName 
    ? `💬 ${chatName}` 
    : `💬 ${senderName}`;
  
  const body = stealthMode
    ? '🔒 Новое сообщение'
    : isMention
      ? `🔔 ${senderName} упомянул вас: ${truncatedText}`
      : `${senderName}: ${truncatedText}`;
  
  const tag = `message-${chatId || 'unknown'}`;
  const existing = activeNotifications.get(tag);
  
  // Определяем звук в зависимости от типа события
  let finalSoundType = soundType;
  if (isMention) {
    finalSoundType = 'alert'; // Упоминания всегда с предупреждающим звуком
  } else if (chatType === 'group') {
    finalSoundType = soundType === 'default' ? 'gentle' : soundType;
  } else if (chatType === 'channel') {
    finalSoundType = soundType === 'default' ? 'chime' : soundType;
  }
  
  // Действия для уведомления
  const actions: NotificationAction[] = [
    {
      action: 'reply',
      title: '💬 Ответить',
    },
    {
      action: 'view',
      title: '👁️ Открыть',
    },
  ];
  
  if (chatType === 'dm') {
    actions.push({
      action: 'call',
      title: '📞 Позвонить',
    });
  }
  
  // Если есть существующее уведомление, обновляем его (группировка)
  if (existing) {
    const count = (existing.data?.count || 1) + 1;
    const newBody = stealthMode
      ? '🔒 Новые сообщения'
      : count > 1
        ? `${count} новых сообщений от ${senderName}`
        : `${senderName}: ${truncatedText}`;
    
    return updateOrCreateNotification(
      tag,
      {
        title,
        body: newBody,
        icon: avatarUrl || '/favicon.png',
        tag,
        image: stealthMode ? undefined : imageUrl,
        actions,
        data: {
          type: 'message',
          chatId,
          count,
          chatType,
          isMention,
          url: chatId ? `/app/chats/${chatId}` : '/app/chats',
        },
        requireInteraction: false,
      },
      playSound,
      soundVolume,
      finalSoundType
    );
  }
  
  return showNotification(
    {
      title,
      body,
      icon: avatarUrl || '/favicon.png',
      tag,
      image: stealthMode ? undefined : imageUrl,
      actions,
      data: {
        type: 'message',
        chatId,
        count: 1,
        chatType,
        isMention,
        url: chatId ? `/app/chats/${chatId}` : '/app/chats',
      },
      requireInteraction: false,
    },
    playSound,
    soundVolume,
    finalSoundType
  );
}

// Уведомление о звонке
export async function notifyCall(
  callerName: string,
  isVideo: boolean = false,
  chatId?: string,
  avatarUrl?: string,
  playSound: boolean = true,
  soundVolume: number = 0.5,
  soundType: SoundType = 'alert'
): Promise<Notification | null> {
  const title = isVideo ? `📹 Видеозвонок от ${callerName}` : `📞 Звонок от ${callerName}`;
  
  return showNotification(
    {
      title,
      body: isVideo ? 'Входящий видеозвонок' : 'Входящий звонок',
      icon: avatarUrl || '/favicon.png',
      tag: `call-${chatId || 'unknown'}`,
      data: {
        type: 'call',
        chatId,
        isVideo,
        url: chatId ? `/app/chats/${chatId}` : '/app/chats',
      },
      requireInteraction: true, // Требуем взаимодействия для звонков
    },
    playSound,
    soundVolume,
    soundType
  );
}

// Уведомление о приглашении в группу
export async function notifyGroupInvite(
  inviterName: string,
  groupName: string,
  groupId?: string,
  playSound: boolean = true,
  soundVolume: number = 0.5,
  soundType: SoundType = 'default'
): Promise<Notification | null> {
  return showNotification(
    {
      title: `👥 Приглашение в группу`,
      body: `${inviterName} приглашает вас в "${groupName}"`,
      icon: '/favicon.png',
      tag: `invite-${groupId || 'unknown'}`,
      data: {
        type: 'group_invite',
        groupId,
        url: groupId ? `/app/chats/${groupId}` : '/app/chats',
      },
      requireInteraction: false,
    },
    playSound,
    soundVolume,
    soundType
  );
}

// Уведомление о системном событии
export async function notifySystem(
  title: string,
  body: string,
  playSound: boolean = false,
  soundVolume: number = 0.5,
  soundType: SoundType = 'default'
): Promise<Notification | null> {
  return showNotification(
    {
      title: `🔔 ${title}`,
      body,
      icon: '/favicon.png',
      tag: `system-${Date.now()}`,
      requireInteraction: false,
    },
    playSound,
    soundVolume,
    soundType
  );
}

// Группировка уведомлений - обновляем существующее уведомление вместо создания нового
const activeNotifications = new Map<string, Notification>();

// Закрытие всех уведомлений с определённым тегом
export function closeNotificationsByTag(tag: string): void {
  if (!isNotificationSupported()) return;
  const notification = activeNotifications.get(tag);
  if (notification) {
    notification.close();
    activeNotifications.delete(tag);
  }
}

// Обновление уведомления (для группировки)
function updateOrCreateNotification(
  tag: string,
  options: NotificationOptions,
  playSound: boolean = true,
  soundVolume: number = 0.5,
  soundType: SoundType = 'default'
): Notification | null {
  if (!isNotificationSupported()) return null;
  
  const existing = activeNotifications.get(tag);
  if (existing) {
    // Обновляем существующее уведомление
    existing.close();
    activeNotifications.delete(tag);
  }
  
  // Создаём новое уведомление
  if (playSound) {
    playNotificationSound(soundVolume, soundType);
  }
  
  const notification = new Notification(options.title, {
    icon: options.icon || '/favicon.png',
    badge: options.badge || '/favicon.png',
    tag: tag,
    data: options.data,
    requireInteraction: options.requireInteraction || false,
    silent: options.silent || false,
    body: options.body,
  });
  
  activeNotifications.set(tag, notification);
  
  setTimeout(() => {
    notification.close();
    activeNotifications.delete(tag);
  }, 5000);
  
  // Обработка клика на уведомление
  notification.onclick = () => {
    window.focus();
    notification.close();
    activeNotifications.delete(tag);
    if (options.data?.url) {
      window.location.href = options.data.url;
    }
  };
  
  // Обработка действий в уведомлении
  if ('addEventListener' in notification) {
    (notification as any).addEventListener('click', (event: any) => {
      const action = event.action;
      if (action === 'reply') {
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
      } else if (action === 'call') {
        if (options.data?.chatId) {
          window.location.href = `${options.data.url}?call=true`;
        }
      } else if (action === 'view') {
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
      }
      notification.close();
      activeNotifications.delete(tag);
    });
  }
  
  return notification;
}
