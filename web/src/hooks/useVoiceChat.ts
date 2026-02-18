/**
 * Хук управления голосовым каналом: подключение, участники, мут, индикатор «говорения».
 * Сигнализация через WebSocket (voice:join/leave/signal), медиа — WebRTC.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, sendWebSocketMessage } from '../services/websocket';
import { api } from '../services/api';
import type { UseVoiceChatOptions, UseVoiceChatReturn, VoiceParticipantInfo } from '../types/voice';

const ICE_SERVERS_FALLBACK: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useVoiceChat({
  chatId,
  currentUserId,
  autoJoin = false,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [participants, setParticipants] = useState<VoiceParticipantInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceServersRef = useRef<RTCConfiguration['iceServers']>(ICE_SERVERS_FALLBACK);
  const speakingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<{ analyser: AnalyserNode; ctx: AudioContext } | null>(null);

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const addOrUpdateParticipant = useCallback((userId: string, patch: Partial<VoiceParticipantInfo>) => {
    setParticipants((prev) => {
      const next = [...prev];
      const i = next.findIndex((p) => p.userId === userId);
      const base: VoiceParticipantInfo = i >= 0 ? next[i] : { userId, isMuted: false, isSpeaking: false };
      const updated = { ...base, ...patch };
      if (i >= 0) next[i] = updated;
      else next.push(updated);
      return next;
    });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
    setParticipants((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  const closeAllPeers = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
  }, []);

  const createPeerConnection = useCallback(
    async (userId: string, isInitiator: boolean) => {
      if (userId === currentUserId) return;
      const stream = localStreamRef.current;
      if (!stream) return;

      try {
        const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const screenStream = screenStreamRef.current;
        if (screenStream?.getVideoTracks().length) {
          pc.addTrack(screenStream.getVideoTracks()[0], screenStream);
        }

        pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
          if (!remoteStream) return;
          if (event.track.kind === 'video') {
            setRemoteScreenStreams((prev) => ({ ...prev, [userId]: remoteStream }));
            event.track.onended = () => {
              setRemoteScreenStreams((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
              });
            };
          } else {
            addOrUpdateParticipant(userId, {});
          }
        };

        pc.onconnectionstatechange = () => {
          if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
            removeParticipant(userId);
            peersRef.current.delete(userId);
            setRemoteScreenStreams((prev) => {
              const next = { ...prev };
              delete next[userId];
              return next;
            });
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate)
            sendWebSocketMessage('voice:signal', {
              chatId: chatIdRef.current,
              to: userId,
              data: { type: 'ice', candidate: e.candidate },
            });
        };

        peersRef.current.set(userId, pc);

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendWebSocketMessage('voice:signal', {
            chatId: chatIdRef.current,
            to: userId,
            data: { type: 'offer', sdp: offer },
          });
        }
      } catch (err) {
        console.error('createPeerConnection', err);
      }
    },
    [currentUserId, addOrUpdateParticipant, removeParticipant]
  );

  const handleSignal = useCallback(
    async (fromUserId: string, data: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      if (fromUserId === currentUserId) return;
      let pc = peersRef.current.get(fromUserId);
      if (data.type === 'offer' && !pc) {
        await createPeerConnection(fromUserId, false);
        pc = peersRef.current.get(fromUserId);
      }
      if (!pc) return;
      try {
        if (data.type === 'offer' && data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWebSocketMessage('voice:signal', {
            chatId: chatIdRef.current,
            to: fromUserId,
            data: { type: 'answer', sdp: answer },
          });
        } else if (data.type === 'answer' && data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === 'ice' && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('handleSignal', err);
      }
    },
    [currentUserId, createPeerConnection]
  );

  const join = useCallback(async () => {
    if (!chatId || isConnected) return;
    setError(null);
    setIsConnecting(true);
    try {
      const res = await api('/api/rtc/ice').catch(() => ({}));
      iceServersRef.current = (res as any)?.iceServers?.length ? (res as any).iceServers : ICE_SERVERS_FALLBACK;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      sendWebSocketMessage('voice:join', { chatId });
      setParticipants((prev) => {
        const me: VoiceParticipantInfo = { userId: currentUserId, isMuted: false, isSpeaking: false };
        if (prev.some((p) => p.userId === currentUserId)) return prev;
        return [...prev, me];
      });
      setIsConnected(true);
    } catch (err: any) {
      setError(err?.message || 'Нет доступа к микрофону');
    } finally {
      setIsConnecting(false);
    }
  }, [chatId, currentUserId, isConnected]);

  const leave = useCallback(() => {
    const cid = chatIdRef.current;
    if (cid) {
      sendWebSocketMessage('voice:leave', { chatId: cid });
      sendWebSocketMessage('voice:mute', { chatId: cid, muted: false });
      sendWebSocketMessage('voice:speaking', { chatId: cid, speaking: false });
      sendWebSocketMessage('voice:screen-stop', { chatId: cid });
    }
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    analyserRef.current?.ctx.close();
    analyserRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    closeAllPeers();
    setParticipants([]);
    setRemoteScreenStreams({});
    setIsConnected(false);
    setIsMuted(false);
    setIsDeafened(false);
  }, [closeAllPeers]);

  const setScreenStream = useCallback(async (stream: MediaStream | null) => {
    screenStreamRef.current = stream;
    const peers = peersRef.current;
    if (peers.size === 0) return;
    const videoTrack = stream?.getVideoTracks()[0];
    for (const [userId, pc] of peers) {
      try {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoTrack) {
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream!);
          }
        } else {
          if (videoSender) pc.removeTrack(videoSender);
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWebSocketMessage('voice:signal', {
          chatId: chatIdRef.current,
          to: userId,
          data: { type: 'offer', sdp: offer },
        });
      } catch (err) {
        console.error('setScreenStream renegotiate', userId, err);
      }
    }
  }, []);

  const setMuted = useCallback(
    (muted: boolean) => {
      const stream = localStreamRef.current;
      if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
      setIsMuted(muted);
      sendWebSocketMessage('voice:mute', { chatId: chatIdRef.current, muted });
    },
    []
  );

  const setDeafened = useCallback((deafened: boolean) => {
    setIsDeafened(deafened);
  }, []);

  useEffect(() => {
    if (!chatId) return;
    const socket = getSocket();
    if (!socket) return;

    const onMessage = (event: MessageEvent) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : '';
        const lines = raw.split('\n').filter((m) => m.trim());
        for (const line of lines) {
          const data = JSON.parse(line);
        const type = data.type;
        const msgChatId = data.chatId;
        if (msgChatId !== chatIdRef.current) continue;

        if (type === 'voice:participants' && Array.isArray(data.members)) {
          const members = data.members as string[];
          setParticipants((prev) => {
            const byId = new Map(prev.map((p) => [p.userId, p]));
            members.forEach((id) => {
              if (!byId.has(id)) byId.set(id, { userId: id, isMuted: false, isSpeaking: false });
            });
            return Array.from(byId.values()).filter((p) => members.includes(p.userId));
          });
          members.forEach((userId) => {
            if (userId !== currentUserId) createPeerConnection(userId, true);
          });
        } else if (type === 'voice:peer-join') {
          const userId = data.userId;
          if (userId && userId !== currentUserId) {
            addOrUpdateParticipant(userId, {});
            createPeerConnection(userId, true);
          }
        } else if (type === 'voice:peer-leave') {
          const userId = data.userId;
          if (userId) {
            peersRef.current.get(userId)?.close();
            peersRef.current.delete(userId);
            removeParticipant(userId);
          }
        } else if (type === 'voice:signal' && data.from && data.data) {
          handleSignal(data.from, data.data);
        } else if (type === 'voice:mute' && data.from !== undefined) {
          addOrUpdateParticipant(data.from, { isMuted: !!data.muted });
        } else if (type === 'voice:speaking' && data.from !== undefined) {
          addOrUpdateParticipant(data.from, { isSpeaking: !!data.speaking });
        }
        }
      } catch (_) {}
    };

    socket.addEventListener('message', onMessage);
    return () => socket.removeEventListener('message', onMessage);
  }, [chatId, currentUserId, addOrUpdateParticipant, removeParticipant, createPeerConnection, handleSignal]);

  useEffect(() => {
    if (!isConnected || !localStreamRef.current) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = audioContext.createMediaStreamSource(localStreamRef.current);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    src.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyserRef.current = { analyser, ctx: audioContext };

    const tick = () => {
      if (!analyserRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const speaking = sum > 80;
      sendWebSocketMessage('voice:speaking', { chatId: chatIdRef.current, speaking });
      addOrUpdateParticipant(currentUserId, { isSpeaking: speaking });
    };

    speakingIntervalRef.current = setInterval(tick, 200);
    return () => {
      if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);
      audioContext.close();
    };
  }, [isConnected, currentUserId, addOrUpdateParticipant]);

  const joinedRef = useRef(false);
  useEffect(() => {
    if (autoJoin && chatId && currentUserId) {
      join();
      joinedRef.current = true;
    }
    return () => {
      if (joinedRef.current) leave();
      joinedRef.current = false;
    };
  }, []);

  return {
    participants,
    isConnected,
    isMuted,
    isDeafened,
    isConnecting,
    error,
    remoteScreenStreams,
    join,
    leave,
    setMuted,
    setDeafened,
    setScreenStream,
  };
}
