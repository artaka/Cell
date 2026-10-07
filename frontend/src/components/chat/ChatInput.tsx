import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useUI } from '../../context/UIContext';
import { Send, Paperclip, Smile, Mic, Image, FileText, MapPin, UserPlus } from 'lucide-react';

export const ChatInput: React.FC = () => {
  const { sendMessage, sendTyping, activeChatId, activeChat, isChatTyping, typingUsernames } = useChat();
  const { openMediaPicker, openVoiceModal, showToast } = useUI();

  const [text, setText] = useState('');
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSentRef = useRef<boolean>(false);
  const lastTypingSentTimeRef = useRef<number>(0);

  // Common quick emojis
  const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😊', '😂', '🎉', '👋', '✅', '✨', '🙏', '💯', '🚀'];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollH, 120)}px`;
    }
  }, [text]);

  // Clean up typing indicator when switching chats or unmounting
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (isTypingSentRef.current) {
        sendTyping(false);
        isTypingSentRef.current = false;
      }
    };
  }, [activeChatId, sendTyping]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const hasText = val.trim().length > 0;

    if (hasText) {
      const now = Date.now();
      // Send typing:true ONLY if not already sent, or if 3 seconds have passed (to refresh display)
      if (!isTypingSentRef.current || now - lastTypingSentTimeRef.current > 3000) {
        sendTyping(true);
        isTypingSentRef.current = true;
        lastTypingSentTimeRef.current = now;
      }

      // Reset the inactivity timer (user stopped typing for 2.5s)
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        if (isTypingSentRef.current) {
          sendTyping(false);
          isTypingSentRef.current = false;
        }
      }, 2500);
    } else {
      // User erased all text
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (isTypingSentRef.current) {
        sendTyping(false);
        isTypingSentRef.current = false;
      }
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');

    // Immediately stop typing indicator on send
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingSentRef.current) {
      sendTyping(false);
      isTypingSentRef.current = false;
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = '42px';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setIsEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const isGroup = activeChat?.type === 'group';
  let inputTypingText = isGroup ? 'Кто-то печатает' : 'Собеседник печатает';
  if (typingUsernames.length === 1) {
    inputTypingText = `${typingUsernames[0]} печатает`;
  } else if (typingUsernames.length === 2) {
    inputTypingText = `${typingUsernames[0]} и ${typingUsernames[1]} печатают`;
  } else if (typingUsernames.length > 2) {
    inputTypingText = `${typingUsernames[0]} и ещё ${typingUsernames.length - 1} печатают`;
  }

  return (
    <footer className="chat-footer-bar relative">
      {/* Floating typing indicator */}
      {activeChatId && isChatTyping(activeChatId) && (
        <div className="absolute -top-7 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 dark:bg-[#182229]/95 backdrop-blur border border-emerald-500/30 shadow-md text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-modal-in select-none">
          <span className="truncate max-w-[240px]">{inputTypingText}</span>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      )}

      {/* Attachment menu dropdown */}
      {isAttachOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsAttachOpen(false)} />
          <div className="attachment-dropdown animate-modal-in">
            <button
              onClick={() => {
                setIsAttachOpen(false);
                openMediaPicker();
              }}
              className="attachment-action-item"
            >
              <div className="attachment-icon-badge bg-emerald-500">
                <Image size={15} />
              </div>
              <span className="font-medium">Фото и видео</span>
            </button>

            <button
              onClick={() => {
                setIsAttachOpen(false);
                openMediaPicker();
              }}
              className="attachment-action-item"
            >
              <div className="attachment-icon-badge bg-blue-500">
                <FileText size={15} />
              </div>
              <span className="font-medium">Документ</span>
            </button>

            <button
              onClick={() => {
                setIsAttachOpen(false);
                showToast('Геолокация в разработке', 'info');
              }}
              className="attachment-action-item"
            >
              <div className="attachment-icon-badge bg-amber-500">
                <MapPin size={15} />
              </div>
              <span className="font-medium">Геопозиция</span>
            </button>

            <button
              onClick={() => {
                setIsAttachOpen(false);
                showToast('Отправка контактов в разработке', 'info');
              }}
              className="attachment-action-item"
            >
              <div className="attachment-icon-badge bg-purple-500">
                <UserPlus size={15} />
              </div>
              <span className="font-medium">Контакт</span>
            </button>
          </div>
        </>
      )}

      {/* Emoji popover */}
      {isEmojiOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsEmojiOpen(false)} />
          <div className="absolute bottom-[calc(100%+10px)] left-8 bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] p-2 rounded-xl shadow-xl z-50 grid grid-cols-6 gap-1 animate-modal-in">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-[#202c33] rounded-lg transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Attachment button */}
      <button
        onClick={() => setIsAttachOpen(!isAttachOpen)}
        className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition flex-shrink-0"
        title="Прикрепить файл"
      >
        <Paperclip size={20} />
      </button>

      {/* Emoji button */}
      <button
        onClick={() => setIsEmojiOpen(!isEmojiOpen)}
        className="p-2 rounded-xl text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition flex-shrink-0"
        title="Эмодзи"
      >
        <Smile size={20} />
      </button>

      {/* Input textarea */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder="Напишите сообщение..."
        className="chat-input-textarea"
      />

      {/* Voice or Send button */}
      {text.trim() ? (
        <button
          onClick={handleSend}
          className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition flex-shrink-0"
          title="Отправить (Enter)"
        >
          <Send size={18} />
        </button>
      ) : (
        <button
          onClick={openVoiceModal}
          className="p-2.5 rounded-xl text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition flex-shrink-0"
          title="Голосовое сообщение"
        >
          <Mic size={20} />
        </button>
      )}
    </footer>
  );
};
