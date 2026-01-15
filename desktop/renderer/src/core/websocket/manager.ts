/**
 * WebSocket Manager
 * 
 * Профессиональный WebSocket клиент с автоматическим переподключением,
 * очередью сообщений и обработкой ошибок
 */

type MessageHandler = (data: any) => void;
type EventType = 'message' | 'presence' | 'typing' | 'read' | 'reaction' | 'call' | 'voice' | string;

interface WebSocketOptions {
  url: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  messageQueue?: boolean;
}

interface QueuedMessage {
  type: string;
  data: any;
  timestamp: number;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: QueuedMessage[] = [];
  private messageQueueEnabled: boolean;
  private handlers: Map<EventType, Set<MessageHandler>> = new Map();
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;

  constructor(options: WebSocketOptions) {
    this.url = options.url;
    this.token = options.token;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || Infinity;
    this.messageQueueEnabled = options.messageQueue !== false;
  }

  /**
   * Подключение к WebSocket
   */
  connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.isConnecting = true;

      try {
        const wsUrl = `${this.url}/ws?token=${encodeURIComponent(this.token)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnecting = false;
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Отправка очереди сообщений
          this.flushMessageQueue();
          
          // Запуск ping
          this.startPing();
          
          // Уведомление о подключении
          this.emit('connected', {});
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Closed:', event.code, event.reason);
          this.isConnecting = false;
          this.isConnected = false;
          this.stopPing();
          
          // Уведомление о отключении
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Автоматическое переподключение
          if (event.code !== 1000) { // Не нормальное закрытие
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Отключение от WebSocket
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Отправка сообщения
   */
  send(type: string, data: any = {}): boolean {
    const message = { type, ...data };

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('[WebSocket] Failed to send message:', error);
        return false;
      }
    } else {
      // Добавление в очередь
      if (this.messageQueueEnabled) {
        this.messageQueue.push({
          type,
          data,
          timestamp: Date.now()
        });
      }
      return false;
    }
  }

  /**
   * Подписка на событие
   */
  on(event: EventType, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Возвращаем функцию отписки
    return () => {
      const handlers = this.handlers.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * Отписка от события
   */
  off(event: EventType, handler: MessageHandler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Эмиссия события
   */
  private emit(event: EventType, data: any) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('[WebSocket] Handler error:', error);
        }
      });
    }
  }

  /**
   * Обработка входящего сообщения
   */
  private handleMessage(message: any) {
    const { type, ...data } = message;

    // Обработка pong
    if (type === 'pong') {
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
      return;
    }

    // Эмиссия события
    this.emit(type, data);
    this.emit('*', { type, ...data });
  }

  /**
   * Планирование переподключения
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.emit('max-reconnect-attempts', {});
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        console.error('[WebSocket] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Отправка очереди сообщений
   */
  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const queued = this.messageQueue.shift();
      if (queued) {
        this.send(queued.type, queued.data);
      }
    }
  }

  /**
   * Запуск ping
   */
  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping', {});

        // Таймаут для pong
        this.pongTimeout = setTimeout(() => {
          console.warn('[WebSocket] Pong timeout, reconnecting...');
          this.disconnect();
          this.scheduleReconnect();
        }, 5000);
      }
    }, 30000); // Ping каждые 30 секунд
  }

  /**
   * Остановка ping
   */
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * Получение состояния подключения
   */
  getState(): 'connecting' | 'connected' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.isConnected) return 'connected';
    return 'disconnected';
  }

  /**
   * Обновление токена
   */
  updateToken(token: string) {
    this.token = token;
    if (this.isConnected) {
      // Переподключение с новым токеном
      this.disconnect();
      this.connect();
    }
  }
}

export default WebSocketManager;
