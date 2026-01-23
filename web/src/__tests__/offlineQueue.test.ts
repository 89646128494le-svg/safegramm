import {
  addToOfflineQueue,
  removeFromOfflineQueue,
  getOfflineQueue,
  clearOfflineQueue,
  processOfflineQueue,
  isOnline
} from '../services/offlineQueue';

// Мокаем localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Мокаем fetch
global.fetch = jest.fn();

describe('offlineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    (global.fetch as jest.Mock).mockClear();
  });

  test('should add message to offline queue', () => {
    const message = {
      chatId: 'chat1',
      text: 'Test message',
      type: 'text' as const,
      data: {}
    };

    const id = addToOfflineQueue(message);
    expect(id).toBeDefined();
    
    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].text).toBe('Test message');
  });

  test('should remove message from queue', () => {
    const message = {
      chatId: 'chat1',
      text: 'Test message',
      type: 'text' as const,
      data: {}
    };

    const id = addToOfflineQueue(message);
    removeFromOfflineQueue(id);
    
    const queue = getOfflineQueue();
    expect(queue.length).toBe(0);
  });

  test('should clear all messages from queue', () => {
    addToOfflineQueue({
      chatId: 'chat1',
      text: 'Message 1',
      type: 'text' as const,
      data: {}
    });
    
    addToOfflineQueue({
      chatId: 'chat1',
      text: 'Message 2',
      type: 'text' as const,
      data: {}
    });

    clearOfflineQueue();
    
    const queue = getOfflineQueue();
    expect(queue.length).toBe(0);
  });

  test('should process queue when online', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'msg1' })
    });

    addToOfflineQueue({
      chatId: 'chat1',
      text: 'Test message',
      type: 'text' as const,
      data: { text: 'Test message' }
    });

    // Мокаем isOnline как true
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    await processOfflineQueue();

    // Проверяем, что fetch был вызван
    expect(global.fetch).toHaveBeenCalled();
  });
});
