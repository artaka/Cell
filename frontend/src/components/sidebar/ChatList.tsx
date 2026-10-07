import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { chatsApi } from '../../api/chats';
import { UserResponse } from '../../api/types';
import { SearchBar } from './SearchBar';
import { ChatListItem } from './ChatListItem';
import { Avatar } from '../common/Avatar';
import { MessageSquarePlus, UserCheck, MessageSquare } from 'lucide-react';

export const ChatList: React.FC = () => {
  const { user } = useAuth();
  const {
    chats,
    activeChatId,
    selectChat,
    createDirectChat,
    isLoadingChats,
    isChatTyping,
    getChatTypingUsernames,
    getMemberUsername,
  } = useChat();
  const { openDirectModal } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalUsers, setGlobalUsers] = useState<UserResponse[]>([]);

  // Debounced global search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setGlobalUsers([]);
      setIsSearchingGlobal(false);
      return;
    }

    setIsSearchingGlobal(true);
    const timer = setTimeout(async () => {
      try {
        const res = await chatsApi.searchUsers(searchQuery);
        setGlobalUsers(res.users || []);
      } catch (e) {
        console.warn('[Search] Global search error:', e);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter existing chats locally
  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleStartChatWithUser = async (targetUser: UserResponse) => {
    try {
      await createDirectChat(targetUser.id);
      setSearchQuery('');
    } catch {
      // error handled in context
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <SearchBar
        query={searchQuery}
        onChange={setSearchQuery}
        isLoading={isSearchingGlobal}
      />

      <div className="chat-list-scroll">
        {/* Global users search section */}
        {searchQuery.trim().length >= 2 && (
          <div className="p-2 border-b border-slate-100 dark:border-[#222e35] bg-slate-50/50 dark:bg-[#182229]/50">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-2 py-1 block">
              Найденные пользователи ({globalUsers.length})
            </span>
            {globalUsers.length === 0 && !isSearchingGlobal && (
              <p className="text-xs text-slate-400 dark:text-slate-500 px-2 py-1">
                Пользователи с таким именем не найдены
              </p>
            )}
            <div className="flex flex-col gap-1 mt-1">
              {globalUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleStartChatWithUser(u)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-[#202c33] cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.username} size="sm" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {u.username}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {u.email}
                      </div>
                    </div>
                  </div>
                  <button className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition flex items-center gap-1">
                    <MessageSquare size={13} />
                    <span>Написать</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Chats List */}
        {isLoadingChats && chats.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-xs text-slate-400">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent mr-2" />
            Загрузка списка чатов...
          </div>
        ) : filteredChats.length === 0 && searchQuery.trim() === '' ? (
          <div className="flex flex-col items-center justify-center p-8 text-center my-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <MessageSquarePlus size={26} />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              У вас пока нет чатов
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[220px] mt-1 mb-4">
              Найдите собеседника по имени или почте и начните диалог
            </p>
            <button
              onClick={openDirectModal}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <UserCheck size={14} />
              <span>Найти людей</span>
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const lastSender = chat.last_message
              ? chat.last_message.sender_id === user?.id
                ? 'Вы'
                : chat.type === 'group'
                ? getMemberUsername(chat.last_message.sender_id, chat.id)
                : ''
              : '';

            return (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
                isTyping={isChatTyping(chat.id)}
                typingUsernames={getChatTypingUsernames(chat.id)}
                lastSenderName={lastSender}
                onClick={() => selectChat(chat.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
