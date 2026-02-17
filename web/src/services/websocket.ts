// WebSocket клиент для Go бэкенда (стандартный WebSocket, не Socket.IO)

let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function getSocket(): WebSocket | null {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token found, cannot connect WebSocket');
    return null;
  }

  const base = (typeof import.meta.env.VITE_WS_URL === 'string' && import.meta.env.VITE_WS_URL !== '')
    ? import.meta.env.VITE_WS_URL.replace(/\/$/, '')
    : (typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL !== ''
        ? import.meta.env.VITE_API_URL
        : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080')).replace(/\/$/, '');
  const wsOrigin = base.startsWith('http') ? base.replace(/^https?/, 'ws') : (typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host : 'ws://localhost:8080');
  const wsUrl = wsOrigin + '/ws?token=' + encodeURIComponent(token);

  if (ws && ws.readyState === WebSocket.OPEN) {
    return ws;
  }

  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      ws = null;
      
      // Автопереподключение
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        reconnectTimeout = setTimeout(() => {
          getSocket();
        }, 1000 * reconnectAttempts);
      }
    };

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

export function sendWebSocketMessage(type: string, data: any) {
  const socket = getSocket();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...data }));
  } else {
    console.warn('WebSocket not connected');
  }
}
