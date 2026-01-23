// Офлайн очередь сообщений

interface QueuedMessage {
  id: string;
  chatId: string;
  text?: string;
  attachmentUrl?: string;
  replyToId?: string;
  type: 'text' | 'media' | 'voice' | 'location' | 'poll';
  data?: any;
  timestamp: number;
  retries: number;
}

const QUEUE_STORAGE_KEY = 'safegram_offline_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 секунд

// Загрузить очередь из localStorage
export function loadOfflineQueue(): QueuedMessage[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load offline queue:', e);
    return [];
  }
}

// Сохранить очередь в localStorage
function saveOfflineQueue(queue: QueuedMessage[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue:', e);
  }
}

// Добавить сообщение в очередь
export function addToOfflineQueue(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retries'>): string {
  const queue = loadOfflineQueue();
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  const queuedMessage: QueuedMessage = {
    ...message,
    id,
    timestamp: Date.now(),
    retries: 0
  };
  
  queue.push(queuedMessage);
  saveOfflineQueue(queue);
  
  return id;
}

// Удалить сообщение из очереди
export function removeFromOfflineQueue(messageId: string): void {
  const queue = loadOfflineQueue();
  const filtered = queue.filter(m => m.id !== messageId);
  saveOfflineQueue(filtered);
}

// Получить все сообщения из очереди
export function getOfflineQueue(): QueuedMessage[] {
  return loadOfflineQueue();
}

// Очистить очередь
export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

// Попытка отправить сообщения из очереди
export async function processOfflineQueue(
  sendMessage: (message: QueuedMessage) => Promise<void>
): Promise<{ success: number; failed: number }> {
  const queue = loadOfflineQueue();
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;
  const updatedQueue: QueuedMessage[] = [];

  for (const message of queue) {
    try {
      await sendMessage(message);
      success++;
      // Удаляем успешно отправленное сообщение
    } catch (e) {
      // Увеличиваем счетчик попыток
      message.retries++;
      
      if (message.retries < MAX_RETRIES) {
        // Оставляем в очереди для повторной попытки
        updatedQueue.push(message);
        failed++;
      } else {
        // Превышен лимит попыток, удаляем из очереди
        console.warn(`Message ${message.id} exceeded max retries, removing from queue`);
        failed++;
      }
    }
  }

  saveOfflineQueue(updatedQueue);
  return { success, failed };
}

// Проверка онлайн статуса
export function isOnline(): boolean {
  return navigator.onLine;
}

// Подписка на изменения онлайн статуса
export function onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
