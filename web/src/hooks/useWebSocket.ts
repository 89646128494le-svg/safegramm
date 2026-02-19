'use client';

import { useEffect, useRef, useState } from 'react';
import { getApiBase } from '@/lib/api';

export type WSMessage = { type: string; [key: string]: unknown };

export function useWebSocket(token: string | null) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }

    const base = getApiBase().replace(/\/+$/, '');
    const wsScheme = base.startsWith('https') ? 'wss' : 'ws';
    const wsHost = base.replace(/^https?:\/\//, '');
    const wsUrl = `${wsScheme}://${wsHost}/ws?token=${encodeURIComponent(token)}`;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          reconnectRef.current = setTimeout(connect, 3000);
        };
        ws.onerror = () => {};
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data) as WSMessage;
            setLastMessage(data);
          } catch {}
        };
      } catch {
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };
    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [token]);

  const send = (data: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(data));
  };

  return { connected, lastMessage, send };
}
