import React, { useRef, useEffect, useState } from 'react';

interface AudioPlayerProps {
  src: string;
  duration?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export default function AudioPlayer({ src, duration, onPlay, onPause, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
      generateWaveform();
    };

    const handlePlay = () => {
      setIsPlaying(true);
      updateTime();
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      onPause?.();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      onEnded?.();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [src, onPlay, onPause, onEnded]);

  const generateWaveform = async () => {
    try {
      const audio = audioRef.current;
      if (!audio) return;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
      const samples = 50; // Количество столбцов waveform
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        filteredData.push(sum / blockSize);
      }

      // Нормализуем данные
      const max = Math.max(...filteredData);
      const normalized = filteredData.map(val => (val / max) * 100);
      setWaveformData(normalized);
    } catch (e) {
      console.warn('Failed to generate waveform:', e);
      // Генерируем случайные данные для демонстрации
      setWaveformData(Array.from({ length: 50 }, () => Math.random() * 60 + 20));
    }
  };

  useEffect(() => {
    drawWaveform();
  }, [waveformData, currentTime, audioDuration]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;
    const progress = audioDuration > 0 ? currentTime / audioDuration : 0;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = '#3b82f6';

    waveformData.forEach((value, index) => {
      const barHeight = (value / 100) * height * 0.8;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      const isPlayed = index / waveformData.length < progress;

      ctx.fillStyle = isPlayed ? '#3b82f6' : '#94a3b8';
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || audioDuration === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = progress * audioDuration;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-md)',
      width: '100%',
      maxWidth: '300px'
    }}>
      <button
        onClick={togglePlayPause}
        style={{
          background: 'var(--accent-primary)',
          border: 'none',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          flexShrink: 0
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <canvas
          ref={canvasRef}
          width={200}
          height={40}
          onClick={handleSeek}
          style={{
            width: '100%',
            height: '40px',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)'
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration)}</span>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />
    </div>
  );
}

