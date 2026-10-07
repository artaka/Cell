import React, { useState } from 'react';
import { MessageResponse } from '../../api/types';
import { formatMessageTime } from '../../utils/date';
import { useUI } from '../../context/UIContext';
import { parseMessageMedia, MessageMediaItem, formatAudioDuration } from '../../utils/mediaParser';
import { MediaWithPreloader } from './MediaWithPreloader';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { Check, CheckCheck, Clock, Copy, Phone, Video } from 'lucide-react';

const SENDER_COLORS = [
  'text-emerald-600 dark:text-emerald-400',
  'text-sky-600 dark:text-sky-400',
  'text-violet-600 dark:text-violet-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-teal-600 dark:text-teal-400',
  'text-indigo-600 dark:text-indigo-400',
  'text-orange-600 dark:text-orange-400',
];

const getSenderColor = (id: string): string => {
  if (!id) return SENDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

interface MessageBubbleProps {
  message: MessageResponse;
  isOutgoing: boolean;
  showSender?: boolean;
  senderName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  showSender,
  senderName,
}) => {
  const { showToast, openLightbox } = useUI();
  const [copied, setCopied] = useState(false);

  // Parse {{media:...}} and {{call:...}} tags and clean message text
  const { text: cleanText, media, call } = parseMessageMedia(message.content);

  // Legacy fallback if message is raw image URL without media tags
  const legacyIsImage = !cleanText && !media.length && (
    /^https?:\/\/.*\.(png|jpg|jpeg|webp|gif)$/i.test(message.content.trim()) ||
    message.content.startsWith('data:image/') ||
    message.content.startsWith('/cell-media/')
  );

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = cleanText || message.content;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    showToast('Текст скопирован', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const renderMediaItem = (item: MessageMediaItem, index: number) => {
    // 1. Voice / Audio message
    if (item.type === 'audio' || /\.(webm|ogg|mp3|m4a|wav)$/i.test(item.url)) {
      return (
        <div key={`${item.url}_${index}`} className="mb-1">
          <VoiceMessageBubble
            url={item.url}
            initialDuration={item.duration}
            isOutgoing={isOutgoing}
          />
        </div>
      );
    }

    // 2. Video message with blurred preloader
    if (item.type === 'video' || /\.(mp4|mov)$/i.test(item.url)) {
      return (
        <div key={`${item.url}_${index}`} className="mb-1.5">
          <MediaWithPreloader
            url={item.url}
            type="video"
            onClick={() => openLightbox(item.url)}
          />
        </div>
      );
    }

    // 3. Image with blurred preloader and spinning loader with cross icon
    return (
      <div key={`${item.url}_${index}`} className="mb-1.5">
        <MediaWithPreloader
          url={item.url}
          type="image"
          onClick={() => openLightbox(item.url)}
        />
      </div>
    );
  };

  return (
    <div
      className={`msg-bubble-wrapper ${isOutgoing ? 'outgoing' : 'incoming'} group`}
      title={isOutgoing ? 'Вы' : (senderName || 'Собеседник')}
    >
      {/* Sender name for group chats if incoming */}
      {!isOutgoing && showSender && senderName && (
        <span
          className={`text-[11px] font-semibold mb-0.5 ml-2 select-none ${getSenderColor(
            message.sender_id
          )}`}
        >
          {senderName}
        </span>
      )}

      <div className="msg-bubble-content">
        {/* Render attached media (photos, videos, voice) without showing raw tags */}
        {media.length > 0 && (
          <div className="flex flex-col gap-1">
            {media.map((item, idx) => renderMediaItem(item, idx))}
          </div>
        )}

        {/* Legacy image display with preloader */}
        {legacyIsImage && (
          <div className="mb-1">
            <MediaWithPreloader
              url={message.content}
              type="image"
              onClick={() => openLightbox(message.content)}
            />
          </div>
        )}

        {/* Call message card */}
        {call && (
          <div className="flex items-center gap-3 py-1.5 px-1 min-w-[190px] border-b border-slate-200/20 dark:border-slate-700/30 mb-1">
            <div
              className={`p-2.5 rounded-full ${
                call.status === 'missed'
                  ? 'bg-red-500/15 text-red-500'
                  : call.status === 'started' || call.status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse'
                  : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'
              }`}
            >
              {call.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {call.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {call.status === 'missed'
                  ? 'Пропущенный звонок'
                  : call.status === 'ended'
                  ? `Звонок завершен${call.duration ? ` • ${formatAudioDuration(call.duration)}` : ''}`
                  : 'Идет звонок...'}
              </span>
            </div>
          </div>
        )}

        {/* Clean text without media/call tags */}
        {cleanText ? (
          <span className="whitespace-pre-wrap leading-relaxed select-text">
            {cleanText}
          </span>
        ) : null}

        {/* Timestamp and Delivery status */}
        <div className="msg-meta-row">
          <span>{formatMessageTime(message.created_at)}</span>

          {isOutgoing && (
            <span
              className="inline-flex items-center ml-0.5"
              title={
                message.isPending
                  ? 'Отправляется...'
                  : message.isRead
                  ? 'Прочитано собеседником'
                  : 'Доставлено на сервер'
              }
            >
              {message.isPending ? (
                <Clock size={12} className="text-slate-400 animate-pulse" />
              ) : message.isRead ? (
                <CheckCheck size={14} className="text-emerald-700 dark:text-emerald-300 font-bold" />
              ) : (
                <Check size={13} className="text-slate-400 dark:text-slate-400" />
              )}
            </span>
          )}

          {/* Quick copy button on hover */}
          {cleanText && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 hover:text-slate-900 dark:hover:text-white transition ml-1"
              title="Скопировать текст"
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
