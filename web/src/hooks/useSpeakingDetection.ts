import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 0.02;
const SMOOTHING = 0.8;
const INTERVAL_MS = 150;

/** Детектор речи по уровню аудио (AnalyserNode). Возвращает 0..1 и isSpeaking. */
export function useSpeakingDetection(stream: MediaStream | null, enabled: boolean): { level: number; isSpeaking: boolean } {
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const lastLevelRef = useRef(0);

  useEffect(() => {
    if (!stream || !enabled) {
      setLevel(0);
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setLevel(0);
      setIsSpeaking(false);
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = SMOOTHING;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const avg = sum / dataArray.length / 255;
      const smoothed = lastLevelRef.current * SMOOTHING + avg * (1 - SMOOTHING);
      lastLevelRef.current = smoothed;
      setLevel(smoothed);
      setIsSpeaking(smoothed > THRESHOLD);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      try {
        ctx.close();
      } catch {}
      analyserRef.current = null;
      audioContextRef.current = null;
    };
  }, [stream, enabled]);

  return { level, isSpeaking };
}
