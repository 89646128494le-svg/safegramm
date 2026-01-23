// Оптимизированный WebSocket клиент с батчингом и сжатием

import { getSocket, sendWebSocketMessage as originalSend } from './websocket';

interface BatchedMessage {
  type: string;
  data: any;
  timestamp: number;
}

let messageBatch: BatchedMessage[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY = 50; // 50ms батчинг
const MAX_BATCH_SIZE = 10; // Максимум сообщений в батче

// Сжатие данных (простая реализация через JSON.stringify с минификацией)
function compressData(data: any): string {
  // В реальности можно использовать pako или другие библиотеки сжатия
  return JSON.stringify(data);
}

// Распаковка данных
function decompressData(compressed: string): any {
  return JSON.parse(compressed);
}

// Отправка сообщения с батчингом
export function sendWebSocketMessage(type: string, data: any, immediate: boolean = false): void {
  const message: BatchedMessage = {
    type,
    data,
    timestamp: Date.now()
  };

  if (immediate || messageBatch.length >= MAX_BATCH_SIZE) {
    // Отправляем немедленно
    flushBatch();
    sendMessage(message);
  } else {
    // Добавляем в батч
    messageBatch.push(message);
    
    // Устанавливаем таймер для отправки батча
    if (!batchTimeout) {
      batchTimeout = setTimeout(() => {
        flushBatch();
      }, BATCH_DELAY);
    }
  }
}

// Отправить одно сообщение
function sendMessage(message: BatchedMessage): void {
  const socket = getSocket();
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      const compressed = compressData({ type: message.type, ...message.data });
      socket.send(compressed);
    } catch (e) {
      console.error('Failed to send WebSocket message:', e);
      // Fallback на оригинальную отправку
      originalSend(message.type, message.data);
    }
  } else {
    console.warn('WebSocket not connected');
  }
}

// Отправить весь батч
function flushBatch(): void {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }

  if (messageBatch.length === 0) {
    return;
  }

  const socket = getSocket();
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      // Группируем сообщения по типам
      const grouped = new Map<string, any[]>();
      
      messageBatch.forEach(msg => {
        if (!grouped.has(msg.type)) {
          grouped.set(msg.type, []);
        }
        grouped.get(msg.type)!.push(msg.data);
      });

      // Отправляем каждую группу
      grouped.forEach((dataArray, type) => {
        if (dataArray.length === 1) {
          sendMessage({ type, data: dataArray[0], timestamp: Date.now() });
        } else {
          // Батч из нескольких сообщений одного типа
          const compressed = compressData({ type, batch: dataArray });
          socket.send(compressed);
        }
      });
    } catch (e) {
      console.error('Failed to send batch:', e);
      // Fallback: отправляем по одному
      messageBatch.forEach(msg => {
        originalSend(msg.type, msg.data);
      });
    }
  }

  messageBatch = [];
}

// Принудительная отправка всех сообщений в батче
export function flushWebSocketBatch(): void {
  flushBatch();
}

// Очистка батча при отключении
export function clearWebSocketBatch(): void {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }
  messageBatch = [];
}

// Переопределяем оригинальную функцию для использования оптимизированной версии
export { getSocket, closeSocket } from './websocket';
