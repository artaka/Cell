export interface MessageMediaItem {
  url: string;
  type: string;
  duration?: number; // duration in seconds for audio/voice
}

export interface MessageCallItem {
  roomId: string;
  type: 'video' | 'audio';
  status: 'started' | 'active' | 'ended' | 'missed';
  duration?: number; // duration in seconds
}

export interface ParsedMessageContent {
  text: string;
  media: MessageMediaItem[];
  call?: MessageCallItem;
}

// Regex to match {{media:URL type:TYPE}} or {{media:URL type:TYPE duration:SEC}}
const MEDIA_TAG_REGEX = /\{\{media:([^\s}]+)\s+type:([^\s}]+)(?:\s+duration:([^\s}]+))?\}\}/g;

// Regex to match {{call:ROOM_ID type:TYPE status:STATUS [duration:SEC]}}
const CALL_TAG_REGEX = /\{\{call:([^\s}]+)\s+type:([^\s}]+)\s+status:([^\s}]+)(?:\s+duration:([^\s}]+))?\}\}/g;

/**
 * Parses raw message text, extracting all {{media:...}} and {{call:...}} tags
 * and returning the clean text with tags stripped out.
 */
export function parseMessageMedia(rawText: string): ParsedMessageContent {
  if (!rawText) {
    return { text: '', media: [] };
  }

  const media: MessageMediaItem[] = [];
  let call: MessageCallItem | undefined;
  let match: RegExpExecArray | null;

  // 1. Parse media tags
  MEDIA_TAG_REGEX.lastIndex = 0;
  while ((match = MEDIA_TAG_REGEX.exec(rawText)) !== null) {
    let durationSec: number | undefined;
    if (match[3]) {
      const durStr = match[3];
      if (durStr.includes(':')) {
        const parts = durStr.split(':');
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseInt(parts[1], 10) || 0;
        durationSec = mins * 60 + secs;
      } else {
        const parsed = parseFloat(durStr);
        if (!isNaN(parsed)) {
          durationSec = Math.round(parsed);
        }
      }
    }

    media.push({
      url: match[1],
      type: match[2].toLowerCase(),
      duration: durationSec,
    });
  }

  // 2. Parse call tags
  CALL_TAG_REGEX.lastIndex = 0;
  if ((match = CALL_TAG_REGEX.exec(rawText)) !== null) {
    let durationSec: number | undefined;
    if (match[4]) {
      const dur = parseInt(match[4], 10);
      if (!isNaN(dur)) durationSec = dur;
    }

    call = {
      roomId: match[1],
      type: (match[2].toLowerCase() === 'audio' ? 'audio' : 'video') as 'video' | 'audio',
      status: (match[3].toLowerCase() || 'started') as 'started' | 'active' | 'ended' | 'missed',
      duration: durationSec,
    };
  }

  // Remove media and call tags from text
  const text = rawText
    .replace(MEDIA_TAG_REGEX, '')
    .replace(CALL_TAG_REGEX, '')
    .trim();

  return { text, media, call };
}

/**
 * Builds a message string with formatted {{media:url type:type [duration:sec]}} tags appended.
 */
export function formatMessageWithMedia(
  text: string,
  mediaList: { url: string; type: string; duration?: number }[]
): string {
  const clean = text.trim();
  if (!mediaList || mediaList.length === 0) {
    return clean;
  }

  const tags = mediaList
    .map((m) => {
      const durPart = m.duration !== undefined && m.duration !== null ? ` duration:${m.duration}` : '';
      return `{{media:${m.url} type:${m.type}${durPart}}}`;
    })
    .join(' ');

  return clean ? `${clean}\n${tags}` : tags;
}

/**
 * Builds a message string for a call event
 */
export function formatCallMessage(roomId: string, type: 'video' | 'audio', status: 'started' | 'ended' | 'missed', duration?: number): string {
  const durPart = duration ? ` duration:${duration}` : '';
  const tag = `{{call:${roomId} type:${type} status:${status}${durPart}}}`;
  const label = type === 'video' ? 'Видеозвонок' : 'Аудиозвонок';
  if (status === 'started') return `${tag} 📞 ${label} начат`;
  if (status === 'ended') return `${tag} 📞 ${label} завершен`;
  if (status === 'missed') return `${tag} 📞 Пропущенный ${label.toLowerCase()}`;
  return tag;
}

/**
 * Formats duration in MM:SS
 */
export function formatAudioDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats a clean snippet for chat list preview
 */
export function formatLastMessageSnippet(rawContent: string): string {
  if (!rawContent) return 'Нет сообщений';

  const { text, media, call } = parseMessageMedia(rawContent);

  if (call) {
    const label = call.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок';
    if (call.status === 'missed') return `📞 Пропущенный ${label.toLowerCase()}`;
    if (call.status === 'ended') {
      const dur = call.duration ? ` (${formatAudioDuration(call.duration)})` : '';
      return `📞 ${label} завершен${dur}`;
    }
    return `📞 ${label}`;
  }

  if (text) {
    return text;
  }

  if (media.length > 0) {
    const first = media[0];
    if (first.type === 'audio') {
      const dur = first.duration ? ` (${formatAudioDuration(first.duration)})` : '';
      return `🎤 Голосовое сообщение${dur}`;
    }
    if (first.type === 'video') return '📹 Видео';
    if (first.type === 'image') return '📷 Фото';
    return '📎 Вложение';
  }

  // Legacy fallback for plain url
  if (/^https?:\/\/.*\.(png|jpg|jpeg|webp|gif)$/i.test(rawContent.trim())) {
    return '📷 Фото';
  }

  return rawContent;
}
