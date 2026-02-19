'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBase } from '@/lib/api';
import {
  handshake,
  packSendMessage,
  unpackReceiveMessage,
  type CoreBridgeState,
} from '@/lib/coreBridge';

export function useCoreBridge(token: string | null) {
  const [state, setState] = useState<CoreBridgeState | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<CoreBridgeState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const sendMessage = useCallback(
    async (text: string) => {
      const s = stateRef.current;
      if (!s || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Нет сессии. Выполните handshake.');
        return;
      }
      try {
        const packet = await packSendMessage(s.sessionId, s.sessionKey, text);
        wsRef.current.send(packet);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка отправки');
      }
    },
    [state]
  );

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setState(null);
      stateRef.current = null;
      setConnected(false);
      return;
    }

    const base = getApiBase().replace(/\/+$/, '');
    const wsScheme = base.startsWith('https') ? 'wss' : 'ws';
    const wsHost = base.replace(/^https?:\/\//, '');
    const wsUrl = `${wsScheme}://${wsHost}/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = 'arraybuffer';
    ws.onopen = async () => {
      setError(null);
      try {
        const bridgeState = await handshake(ws, token);
        setState(bridgeState);
        stateRef.current = bridgeState;
        setConnected(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Handshake failed');
        ws.close();
      }
    };

    ws.onmessage = async (event: MessageEvent) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const buf = new Uint8Array(event.data);
      if (buf.length < 4) return;
      const s = stateRef.current;
      if (!s) return;
      try {
        const { plaintext } = await unpackReceiveMessage(buf, s.sessionKey);
        setLastMessage(plaintext);
      } catch {
        // не наш пакет или ошибка расшифровки
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setState(null);
      stateRef.current = null;
      setConnected(false);
    };
    ws.onerror = () => setError('WebSocket error');

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token]);

  return { state, connected, lastMessage, error, sendMessage };
}
