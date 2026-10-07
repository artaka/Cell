import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatAudioDuration } from '../../utils/mediaParser';

interface VoiceMessageBubbleProps {
  url: string;
  initialDuration?: number;
  isOutgoing: boolean;
}

// Pseudo-random but consistent wave pattern based on url
const generateBars = (seed: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bars: number[] = [];
  const base = [12, 18, 26, 14, 22, 30, 24, 16, 28, 20, 14, 24, 18, 28, 16, 22, 14, 18];
  for (let i = 0; i < 22; i++) {
    const val = base[i % base.length] + (Math.abs(hash + i * 7) % 8) - 4;
    bars.push(Math.max(8, Math.min(28, val)));
  }
  return bars;
};

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  url,
  initialDuration,
  isOutgoing,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(initialDuration || 0);

  const bars = React.useMemo(() => generateBars(url), [url]);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('[VoicePlayer] Playback error:', e);
        setIsPlaying(false);
      });
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = pct * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progressPct = duration > 0 ? currentTime / duration : 0;
  const displayTime = isPlaying || currentTime > 0
    ? formatAudioDuration(Math.round(currentTime))
    : formatAudioDuration(duration);

  return (
    <div className="voice-bubble-container select-none">
      {/* Play/Pause round button */}
      <button
        type="button"
        onClick={togglePlay}
        className="voice-play-btn"
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>

      {/* Waveform track and Duration */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div
          className="voice-wave-track"
          onClick={handleTrackClick}
          title="Перемотка аудио"
        >
          {bars.map((height, i) => {
            const barPct = i / bars.length;
            const isFilled = barPct <= progressPct;

            return (
              <span
                key={i}
                className="voice-wave-track-bar"
                style={{
                  height: `${height}px`,
                  backgroundColor: isFilled
                    ? (isOutgoing ? '#047857' : '#10b981')
                    : (isOutgoing ? 'rgba(5, 150, 105, 0.28)' : 'rgba(148, 163, 184, 0.45)'),
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono mt-0.5 px-0.5">
          <span className="voice-meta-duration">
            {displayTime}
          </span>
          <span className="text-[10px] text-slate-400 opacity-80">
            гс
          </span>
        </div>
      </div>
    </div>
  );
};
