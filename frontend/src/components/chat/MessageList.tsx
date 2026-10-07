import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { MessageBubble } from './MessageBubble';
import { formatGroupDateHeader } from '../../utils/date';
import { ArrowDown, MessageSquareDashed } from 'lucide-react';

export const MessageList: React.FC = () => {
  const { messages, hasMore, isLoadingMessages, loadMoreMessages, activeChat, getMemberUsername } = useChat();
  const { user } = useAuth();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const prevScrollHeightRef = useRef<number>(0);

  // Auto scroll to bottom on new message if near bottom
  useEffect(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

    if (isNearBottom) {
      bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Handle scroll for infinite scroll up and scroll-to-bottom button
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

    // Show button if scrolled up > 300px
    const isUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBottom(isUp);

    // Load older messages if near top
    if (scrollTop < 80 && hasMore && !isLoadingMessages) {
      prevScrollHeightRef.current = scrollHeight;
      loadMoreMessages().then(() => {
        // Restore scroll position so user doesn't jump
        if (scrollRef.current) {
          const newScrollHeight = scrollRef.current.scrollHeight;
          scrollRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
        }
      });
    }
  };

  const scrollToBottom = () => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Group messages by day
  const groupedElements: React.ReactNode[] = [];
  let lastDateStr = '';

  messages.forEach((msg, idx) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== lastDateStr) {
      lastDateStr = msgDate;
      groupedElements.push(
        <div key={`date_${msg.id}_${idx}`} className="date-separator-pill">
          {formatGroupDateHeader(msg.created_at)}
        </div>
      );
    }

    const isOutgoing = msg.sender_id === user?.id;
    const prevMsg = idx > 0 ? messages[idx - 1] : null;
    const isPrevSameDate = prevMsg && new Date(prevMsg.created_at).toDateString() === msgDate;
    const isSameSenderAsPrev = isPrevSameDate && prevMsg?.sender_id === msg.sender_id;
    const senderName = isOutgoing ? 'Вы' : getMemberUsername(msg.sender_id, activeChat?.id);

    groupedElements.push(
      <MessageBubble
        key={msg.id || msg.tempId || idx}
        message={msg}
        isOutgoing={isOutgoing}
        showSender={activeChat?.type === 'group' && !isSameSenderAsPrev}
        senderName={senderName}
      />
    );
  });

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="messages-scroll-area"
      >
        {/* Loading older indicator */}
        {hasMore && (
          <div className="text-center py-2 text-xs text-slate-400">
            {isLoadingMessages ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent" />
                Загрузка более старых сообщений...
              </span>
            ) : (
              <button
                onClick={loadMoreMessages}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition"
              >
                Показать предыдущие сообщения
              </button>
            )}
          </div>
        )}

        {messages.length === 0 && !isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center my-auto p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#182229] text-slate-400 flex items-center justify-center mb-2">
              <MessageSquareDashed size={24} />
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Сообщений пока нет
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Напишите первое сообщение, чтобы начать диалог
            </p>
          </div>
        ) : (
          groupedElements
        )}

        <div ref={bottomAnchorRef} />
      </div>

      {/* Floating button to jump to latest */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="scroll-bottom-btn"
          title="Вниз к последним сообщениям"
          aria-label="Вниз"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
};
