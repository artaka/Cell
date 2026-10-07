import React from 'react';
import { GetChatListItemResponse } from '../../api/types';
import { Avatar } from '../common/Avatar';
import { formatChatListDate } from '../../utils/date';
import { formatLastMessageSnippet } from '../../utils/mediaParser';
import { Users } from 'lucide-react';

interface ChatListItemProps {
  chat: GetChatListItemResponse;
  isActive: boolean;
  isTyping?: boolean;
  typingUsernames?: string[];
  lastSenderName?: string;
  onClick: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  chat,
  isActive,
  isTyping = false,
  typingUsernames = [],
  lastSenderName,
  onClick,
}) => {
  const isGroup = chat.type === 'group';

  let typingLabel = 'печатает';
  if (typingUsernames.length === 1) {
    typingLabel = isGroup ? `${typingUsernames[0]} печатает` : 'печатает';
  } else if (typingUsernames.length > 1) {
    typingLabel = `${typingUsernames[0]} и ещё ${typingUsernames.length - 1} печатают`;
  }

  return (
    <div
      onClick={onClick}
      className={`chat-item-row ${isActive ? 'active' : ''}`}
    >
      <div className="relative">
        <Avatar
          id={chat.id}
          name={chat.title}
          imageUrl={chat.avatar_url || null}
          size="md"
        />
        {isGroup && (
          <span className="absolute -bottom-1 -right-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full p-0.5 border border-white dark:border-[#111b21]">
            <Users size={11} />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {chat.title}
          </h4>
          {chat.last_message && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0">
              {formatChatListDate(chat.last_message.created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {isTyping ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="truncate max-w-[140px]">{typingLabel}</span>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {chat.last_message ? (
                <>
                  {lastSenderName && (
                    <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">
                      {lastSenderName}:
                    </span>
                  )}
                  {formatLastMessageSnippet(chat.last_message.content)}
                </>
              ) : (
                'Нет сообщений'
              )}
            </p>
          )}

          {chat.unread_count > 0 && (
            <span className="chat-unread-badge">
              {chat.unread_count > 99 ? '99+' : chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
