import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../../context/UIContext';
import { useChat } from '../../context/ChatContext';
import { filesApi } from '../../api/files';
import { formatMessageWithMedia, formatAudioDuration } from '../../utils/mediaParser';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Mic, Square, Trash2, Send, Play, Pause, Loader2 } from 'lucide-react';

export const VoiceRecorderModal: React.FC = () => {
  const { isVoiceModalOpen, closeVoiceModal, showToast } = useUI();
  const { sendMessage } = useChat();

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start real recording when modal opens
  useEffect(() => {
    if (isVoiceModalOpen) {
      startRecording();
    } else {
      cleanupRecording();
    }

    return () => {
      cleanupRecording();
    };
  }, [isVoiceModalOpen]);

  // Timer interval while recording
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isVoiceModalOpen && isRecording) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isVoiceModalOpen, isRecording]);

  const startRecording = async () => {
    setSeconds(0);
    setHasRecorded(false);
    setIsPlaying(false);
    audioChunksRef.current = [];
    recordedBlobRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        recordedBlobRef.current = audioBlob;
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayerRef.current = new Audio(audioUrl);
        audioPlayerRef.current.onended = () => setIsPlaying(false);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
    } catch (err: any) {
      console.error('[VoiceRecorder] Mic error:', err);
      showToast('Доступ к микрофону заблокирован или не поддерживается', 'error');
      closeVoiceModal();
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setHasRecorded(true);

      // Stop all mic tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Playback error:', e);
        setIsPlaying(false);
      });
    }
  };

  const cleanupRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    recordedBlobRef.current = null;
    setIsRecording(false);
    setIsPlaying(false);
    setHasRecorded(false);
    setSeconds(0);
    setIsUploading(false);
  };

  const handleSend = async () => {
    if (!recordedBlobRef.current) {
      showToast('Запись не готова', 'error');
      return;
    }

    const recordedSeconds = Math.max(1, seconds);
    setIsUploading(true);

    try {
      // 1. Prepare File object with webm extension (accepted by OpenAPI: .webm, .ogg, .mp3, etc.)
      const ext = recordedBlobRef.current.type.includes('mp4') ? 'm4a' : 'webm';
      const audioFile = new File([recordedBlobRef.current], `voice_${Date.now()}.${ext}`, {
        type: recordedBlobRef.current.type || 'audio/webm',
      });

      // 2. Upload to S3/MinIO via POST /api/v1/files/messages/
      const uploadRes = await filesApi.uploadMessageMedia(audioFile);

      // 3. Format message with special tag and duration: {{media:url type:audio duration:sec}}
      const finalMessage = formatMessageWithMedia('', [
        {
          url: uploadRes.media_url,
          type: 'audio',
          duration: recordedSeconds,
        },
      ]);

      // 4. Send through WebSocket
      sendMessage(finalMessage);
      showToast('Голосовое сообщение отправлено', 'success');

      closeVoiceModal();
      cleanupRecording();
    } catch (err: any) {
      console.error('[VoiceUpload] Failed:', err);
      showToast(err.message || 'Ошибка отправки голосового сообщения', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    cleanupRecording();
    closeVoiceModal();
  };

  return (
    <Modal
      isOpen={isVoiceModalOpen}
      onClose={handleClose}
      title="Запись голосового сообщения"
      maxWidth="sm"
    >
      <div className="flex flex-col items-center py-6 gap-6">
        {/* Animated Microphone Icon */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-red-500 text-white pulse-rec'
              : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <Mic size={36} />
        </div>

        {/* Timer */}
        <div className="flex flex-col items-center">
          <span className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100">
            {formatAudioDuration(seconds)}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            {isRecording ? 'Идет запись звука...' : isUploading ? 'Отправка на сервер...' : 'Запись завершена'}
          </span>
        </div>

        {/* Audio Waveform Bars Simulation */}
        <div className="flex items-center gap-1.5 h-12 w-full justify-center px-4">
          {[40, 65, 30, 85, 50, 95, 70, 45, 80, 60, 90, 40, 75, 55, 30, 85].map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isRecording ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{
                height: isRecording ? `${Math.max(12, (h * (seconds % 3 + 1)) % 48)}px` : `${h * 0.4}px`,
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 w-full justify-center pt-2">
          {isRecording ? (
            <Button variant="secondary" size="md" onClick={handleStop}>
              <Square size={16} />
              <span>Остановить</span>
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="md"
                disabled={isUploading}
                onClick={togglePlayback}
                title="Прослушать"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span>{isPlaying ? 'Пауза' : 'Слушать'}</span>
              </Button>

              <Button
                variant="secondary"
                size="md"
                disabled={isUploading}
                onClick={handleClose}
                className="text-red-500"
              >
                <Trash2 size={16} />
                <span>Удалить</span>
              </Button>

              <Button
                variant="primary"
                size="md"
                disabled={isUploading || !hasRecorded}
                onClick={handleSend}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Отправка...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Отправить</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
