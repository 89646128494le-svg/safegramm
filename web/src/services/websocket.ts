// WebSocket клиент для Go бэкенда (стандартный WebSocket, не Socket.IO)
import { getApiBaseUrl } from './api';

let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

type QueuedMessage = { type: string; data: Record<string, unknown> };
const messageQueue: QueuedMessage[] = [];

function flushMessageQueue() {
  if (!ws || ws.readyState !== WebSocket.OPEN || messageQueue.length === 0) return;
  while (messageQueue.length > 0) {
    const msg = messageQueue.shift()!;
    ws.send(JSON.stringify({ type: msg.type, ...msg.data }));
  }
}

export function getSocket(): WebSocket | null {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token found, cannot connect WebSocket');
    return null;
  }

  const base = getApiBaseUrl().replace(/\/+$/, '');
  const wsOrigin = base.startsWith('https') ? base.replace(/^https/, 'wss') : base.startsWith('http') ? base.replace(/^http/, 'ws') : 'ws://localhost:8081';
  const wsUrl = (wsOrigin.endsWith('/') ? wsOrigin.slice(0, -1) : wsOrigin) + '/ws?token=' + encodeURIComponent(token);

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws;
  }

  if (ws && (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED)) {
    ws = null;
  }

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
      flushMessageQueue();
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      ws = null;

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        reconnectTimeout = setTimeout(() => {
          getSocket();
        }, 1000 * reconnectAttempts);
      }
    };

    if (typeof document !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible' && (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
          reconnectAttempts = 0;
          getSocket();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      ws.addEventListener('close', () => document.removeEventListener('visibilitychange', onVisible), { once: true });
    }

    return ws;
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    return null;
  }
}

export function closeSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  reconnectAttempts = 0;
}

export function sendWebSocketMessage(type: string, data: Record<string, unknown>) {
  const socket = getSocket();
  if (!socket) {
    console.warn('WebSocket not available');
    return;
  }
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...data }));
  } else if (socket.readyState === WebSocket.CONNECTING) {
    messageQueue.push({ type, data });
  } else {
    console.warn('WebSocket not connected');
  }
}
