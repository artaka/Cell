import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { chatsApi } from '../api/chats';
import {
  GetChatListItemResponse,
  MessageResponse,
  WSMessageAckPayload,
  WSNewMessageNotification,
  WSReadNotification,
  WSTypingPayload,
  WSErrorPayload
} from '../api/types';
import { wsService } from '../ws/websocketService';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { sound } from '../utils/sound';

interface ChatContextType {
  chats: GetChatListItemResponse[];
  activeChatId: string | null;
  activeChat: GetChatListItemResponse | null;
  messages: MessageResponse[];
  hasMore: boolean;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  typingMap: Record<string, boolean>; // userId -> isTyping for active chat
  typingUsernames: string[];
  isChatTyping: (chatId: string) => boolean;
  getChatTypingUsernames: (chatId: string) => string[];
  getMemberUsername: (userId: string, chatId?: string) => string;

  loadChats: () => Promise<void>;
  selectChat: (chatId: string) => void;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  markChatAsRead: (chatId: string, messageId: number) => void;
  createDirectChat: (userId: string) => Promise<string>;
  createGroupChat: (title: string, userIds: string[]) => Promise<string>;
  updateChatAvatar: (chatId: string, avatarUrl: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { setMobileView, showToast } = useUI();

  const [chats, setChats] = useState<GetChatListItemResponse[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, MessageResponse[]>>({});
  const [nextCursorByChat, setNextCursorByChat] = useState<Record<string, number | null>>({});
  const [hasMoreByChat, setHasMoreByChat] = useState<Record<string, boolean>>({});

  // Highest read message ID per chat
  const [maxReadIdByChat, setMaxReadIdByChat] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('cell_max_read_ids');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // typing: chatId -> userId -> boolean
  const [typingState, setTypingState] = useState<Record<string, Record<string, boolean>>>({});
  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const activeChat = chats.find((c) => c.id === activeChatId) || null;
  const currentMessages = activeChatId ? messagesByChat[activeChatId] || [] : [];
  const currentHasMore = activeChatId ? hasMoreByChat[activeChatId] ?? false : false;

  // Active chat typing map with lowercase normalized chat id
  const activeTypingMap = (activeChatId && typingState[activeChatId.toLowerCase()]) || {};

  // membersByChat: chatId.toLowerCase() -> { userId.toLowerCase(): username }
  const [membersByChat, setMembersByChat] = useState<Record<string, Record<string, string>>>({});
  const membersLoadingRef = useRef<Record<string, boolean>>({});

  const loadChatMembers = useCallback(async (chatId: string) => {
    if (!chatId) return;
    const normChatId = chatId.toLowerCase();
    if (membersLoadingRef.current[normChatId]) return;
    membersLoadingRef.current[normChatId] = true;

    try {
      const res = await chatsApi.getChatMembers(chatId);
      if (res && res.members) {
        const memberMap: Record<string, string> = {};
        res.members.forEach((m) => {
          if (m.user_id && m.username) {
            memberMap[m.user_id.toLowerCase()] = m.username;
          }
        });
        setMembersByChat((prev) => ({
          ...prev,
          [normChatId]: { ...(prev[normChatId] || {}), ...memberMap },
        }));
      }
    } catch (e) {
      console.warn('[ChatContext] Failed to load members for chat:', chatId, e);
    } finally {
      membersLoadingRef.current[normChatId] = false;
    }
  }, []);

  const getMemberUsername = useCallback(
    (userId: string, chatId?: string): string => {
      if (!userId) return '';
      const normUserId = userId.toLowerCase();
      if (user && normUserId === user.id.toLowerCase()) {
        return user.username || 'Вы';
      }

      const targetChatId = (chatId || activeChatId)?.toLowerCase();
      if (targetChatId) {
        const chatMembers = membersByChat[targetChatId];
        if (chatMembers && chatMembers[normUserId]) {
          return chatMembers[normUserId];
        }

        // Direct chat fallback: other user's username is activeChat/chat title
        const chatObj = chats.find((c) => c.id.toLowerCase() === targetChatId);
        if (chatObj && chatObj.type === 'direct' && chatObj.title) {
          return chatObj.title;
        }
      }

      // Look in any known chat members cache
      for (const chatMap of Object.values(membersByChat)) {
        if (chatMap[normUserId]) {
          return chatMap[normUserId];
        }
      }

      return 'Пользователь';
    },
    [user, activeChatId, membersByChat, chats]
  );

  const getChatTypingUsernames = useCallback(
    (chatId: string): string[] => {
      if (!chatId) return [];
      const normChat = chatId.toLowerCase();
      const chatMap = typingState[normChat];
      if (!chatMap) return [];

      const currentUserId = user?.id ? user.id.toLowerCase() : '';

      return Object.entries(chatMap)
        .filter(([uId, isTyping]) => isTyping && uId.toLowerCase() !== currentUserId)
        .map(([uId]) => getMemberUsername(uId, chatId))
        .filter(Boolean);
    },
    [typingState, user?.id, getMemberUsername]
  );

  const typingUsernames = useMemo(() => {
    if (!activeChatId) return [];
    return getChatTypingUsernames(activeChatId);
  }, [activeChatId, getChatTypingUsernames]);

  const isChatTyping = useCallback(
    (chatId: string): boolean => {
      if (!chatId) return false;
      const key = chatId.toLowerCase();
      const chatMap = typingState[key];
      if (!chatMap) return false;
      return Object.values(chatMap).some(Boolean);
    },
    [typingState]
  );

  const loadChats = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingChats(true);
    try {
      const res = await chatsApi.getChatList();
      setChats(res.chats || []);
    } catch (e: any) {
      console.error('[Chats] Load error:', e);
    } finally {
      setIsLoadingChats(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadChats();
    } else {
      setChats([]);
      setActiveChatId(null);
      setMessagesByChat({});
    }
  }, [isAuthenticated, loadChats]);

  // Preload members for active chat
  useEffect(() => {
    if (activeChatId) {
      loadChatMembers(activeChatId);
    }
  }, [activeChatId, loadChatMembers]);

  // Preload members for all group chats
  useEffect(() => {
    if (chats.length > 0) {
      chats.forEach((c) => {
        if (!membersByChat[c.id.toLowerCase()]) {
          loadChatMembers(c.id);
        }
      });
    }
  }, [chats, membersByChat, loadChatMembers]);

  // Load initial messages for active chat
  const loadChatMessages = async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await chatsApi.getChatMessages(chatId, undefined, 30);
      const normChatId = chatId.toLowerCase();
      const highestReadId = maxReadIdByChat[normChatId] || 0;
      // Backend returns DESC (newest first). Let's sort ASC (oldest to newest) for conversational display.
      const sorted = [...(res.messages || [])].reverse().map((m) => ({
        ...m,
        isRead: m.isRead || (highestReadId > 0 && m.id <= highestReadId),
      }));
      setMessagesByChat((prev) => ({ ...prev, [chatId]: sorted }));
      setNextCursorByChat((prev) => ({ ...prev, [chatId]: res.next_cursor }));
      setHasMoreByChat((prev) => ({ ...prev, [chatId]: res.has_more }));

      // Automatically mark newest message as read if unread
      if (sorted.length > 0) {
        const lastMsg = sorted[sorted.length - 1];
        markChatAsRead(chatId, lastMsg.id);
      }
    } catch (e: any) {
      console.error('[Chat] Load messages error:', e);
      showToast('Не удалось загрузить историю сообщений', 'error');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setMobileView('chat');

    // Reset unread count locally for responsive UX
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c))
    );

    // If messages not loaded yet, fetch them
    if (!messagesByChat[chatId]) {
      loadChatMessages(chatId);
    } else {
      const existing = messagesByChat[chatId];
      if (existing.length > 0) {
        const lastMsg = existing[existing.length - 1];
        markChatAsRead(chatId, lastMsg.id);
      }
    }
  };

  const loadMoreMessages = async () => {
    if (!activeChatId || isLoadingMessages) return;
    const cursor = nextCursorByChat[activeChatId];
    const hasMore = hasMoreByChat[activeChatId];
    if (!hasMore || cursor === null || cursor === undefined) return;

    setIsLoadingMessages(true);
    try {
      const res = await chatsApi.getChatMessages(activeChatId, cursor, 30);
      const normChatId = activeChatId.toLowerCase();
      const highestReadId = maxReadIdByChat[normChatId] || 0;
      const olderSorted = [...(res.messages || [])].reverse().map((m) => ({
        ...m,
        isRead: m.isRead || (highestReadId > 0 && m.id <= highestReadId),
      }));

      setMessagesByChat((prev) => ({
        ...prev,
        [activeChatId]: [...olderSorted, ...(prev[activeChatId] || [])],
      }));
      setNextCursorByChat((prev) => ({ ...prev, [activeChatId]: res.next_cursor }));
      setHasMoreByChat((prev) => ({ ...prev, [activeChatId]: res.has_more }));
    } catch (e: any) {
      console.error('[Chat] Load older messages error:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!activeChatId || !user || !content.trim()) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMsg: MessageResponse = {
      id: Date.now(), // temporary id
      chat_id: activeChatId,
      sender_id: user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      isPending: true,
      tempId,
    };

    // Add optimistically to current chat
    setMessagesByChat((prev) => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), optimisticMsg],
    }));

    // Update last message in chat list
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              last_message: {
                id: optimisticMsg.id,
                sender_id: user.id,
                content: optimisticMsg.content,
                created_at: optimisticMsg.created_at,
              },
            }
          : c
      )
    );

    sound.playSentMessage();

    // Send through WebSocket
    wsService.sendMessage(activeChatId, content.trim(), tempId);
  };

  const lastSentTypingRef = useRef<Record<string, { isTyping: boolean; timestamp: number }>>({});

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!activeChatId || !user) return;

    const last = lastSentTypingRef.current[activeChatId];
    const now = Date.now();

    // Guard against spam: don't re-send if already in that state within 3000ms
    if (last && last.isTyping === isTyping && now - last.timestamp < 3000) {
      return;
    }

    lastSentTypingRef.current[activeChatId] = { isTyping, timestamp: now };
    wsService.sendTyping(activeChatId, user.id, isTyping);
  }, [activeChatId, user]);

  const markChatAsRead = (chatId: string, messageId: number) => {
    if (!chatId || !messageId) return;
    wsService.sendRead(chatId, messageId);
  };

  const createDirectChat = async (targetUserId: string): Promise<string> => {
    try {
      const res = await chatsApi.createDirectChat({ user: targetUserId });
      await loadChats();
      let chatId = '';
      if ('chat_id' in res) {
        chatId = res.chat_id;
      } else {
        chatId = res.id;
      }
      selectChat(chatId);
      return chatId;
    } catch (e: any) {
      showToast(e.message || 'Ошибка создания личного диалога', 'error');
      throw e;
    }
  };

  const createGroupChat = async (title: string, userIds: string[]): Promise<string> => {
    try {
      const res = await chatsApi.createGroupChat({ title, user_ids: userIds });
      await loadChats();
      selectChat(res.id);
      return res.id;
    } catch (e: any) {
      showToast(e.message || 'Ошибка создания группы', 'error');
      throw e;
    }
  };

  const updateChatAvatar = (chatId: string, avatarUrl: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, avatar_url: avatarUrl } : c))
    );
  };

  // WebSocket Event Listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Message ACK
    const unsubscribeAck = wsService.on('message:ack', (payload: WSMessageAckPayload) => {
      const normChatId = String(payload.chat_id).toLowerCase();
      const highestReadId = maxReadIdByChat[normChatId] || 0;

      setMessagesByChat((prev) => {
        const chatKey = Object.keys(prev).find((k) => k.toLowerCase() === normChatId) || payload.chat_id;
        const chatMsgs = prev[chatKey] || [];
        const updated = chatMsgs.map((m) => {
          if (m.tempId === payload.client_msg_temp_id || (m.isPending && m.chat_id.toLowerCase() === normChatId)) {
            return {
              ...m,
              id: payload.message_id,
              created_at: payload.created_at,
              isPending: false,
              isRead: payload.message_id <= highestReadId,
            };
          }
          return m;
        });
        return { ...prev, [chatKey]: updated };
      });
    });

    // 2. New Message
    const unsubscribeNew = wsService.on('message:new', (payload: WSNewMessageNotification) => {
      const isCurrentActive = payload.chat_id === activeChatId;

      const newMsg: MessageResponse = {
        id: payload.id,
        chat_id: payload.chat_id,
        sender_id: payload.sender_id,
        content: payload.content,
        created_at: payload.created_at,
        isPending: false,
      };

      // Add to messages if not already in list
      setMessagesByChat((prev) => {
        const current = prev[payload.chat_id] || [];
        if (current.some((m) => m.id === payload.id)) return prev;
        return { ...prev, [payload.chat_id]: [...current, newMsg] };
      });

      // Update chat list preview and unread count
      setChats((prev) => {
        const found = prev.some((c) => c.id === payload.chat_id);
        if (!found) {
          // If chat is not in list yet, reload chat list
          loadChats();
          return prev;
        }
        return prev.map((c) => {
          if (c.id === payload.chat_id) {
            return {
              ...c,
              last_message: {
                id: payload.id,
                sender_id: payload.sender_id,
                content: payload.content,
                created_at: payload.created_at,
              },
              unread_count: isCurrentActive ? 0 : c.unread_count + 1,
            };
          }
          return c;
        });
      });

      // Sound notification if sender is someone else
      if (payload.sender_id !== user?.id) {
        sound.playIncomingMessage();
      }

      // Mark read if active
      if (isCurrentActive) {
        markChatAsRead(payload.chat_id, payload.id);
      }
    });

    // 3. Typing
    const unsubscribeTyping = wsService.on('typing', (payload: WSTypingPayload) => {
      const currentUserId = user?.id ? String(user.id).toLowerCase() : '';
      const senderId = payload.user_id ? String(payload.user_id).toLowerCase() : '';
      if (!senderId || senderId === currentUserId) return;

      const chatId = payload.chat_id ? String(payload.chat_id).toLowerCase() : '';
      if (!chatId) return;

      const key = `${chatId}_${senderId}`;
      if (typingTimeouts.current[key]) {
        clearTimeout(typingTimeouts.current[key]);
      }

      setTypingState((prev) => {
        const chatTyping = prev[chatId] || {};
        if (chatTyping[senderId] === payload.is_typing) {
          return prev;
        }
        return {
          ...prev,
          [chatId]: {
            ...chatTyping,
            [senderId]: payload.is_typing,
          },
        };
      });

      if (payload.is_typing) {
        // Auto reset after 3.5s
        typingTimeouts.current[key] = setTimeout(() => {
          setTypingState((prev) => {
            const chatTyping = prev[chatId];
            if (!chatTyping || !chatTyping[senderId]) return prev;
            return {
              ...prev,
              [chatId]: {
                ...chatTyping,
                [senderId]: false,
              },
            };
          });
        }, 3500);
      }
    });

    // 4. Read notification
    const unsubscribeRead = wsService.on('read', (payload: WSReadNotification) => {
      const normChatId = String(payload.chat_id).toLowerCase();
      const readMsgId = Number(payload.message_id);

      // Persist max read message id for this chat
      setMaxReadIdByChat((prev) => {
        const currentMax = prev[normChatId] || 0;
        const newMax = Math.max(currentMax, readMsgId);
        const updated = { ...prev, [normChatId]: newMax };
        try {
          localStorage.setItem('cell_max_read_ids', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      // Mark loaded messages up to readMsgId as isRead
      setMessagesByChat((prev) => {
        const chatKey = Object.keys(prev).find((k) => k.toLowerCase() === normChatId) || payload.chat_id;
        const msgs = prev[chatKey];
        if (!msgs) return prev;
        return {
          ...prev,
          [chatKey]: msgs.map((m) =>
            m.id <= readMsgId ? { ...m, isPending: false, isRead: true } : m
          ),
        };
      });
    });

    // 5. WS Error
    const unsubscribeError = wsService.on('error', (payload: WSErrorPayload) => {
      showToast(payload.error || 'Ошибка WebSocket', 'error');
    });

    return () => {
      unsubscribeAck();
      unsubscribeNew();
      unsubscribeTyping();
      unsubscribeRead();
      unsubscribeError();
    };
  }, [isAuthenticated, activeChatId, user?.id, loadChats, showToast]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        activeChat,
        messages: currentMessages,
        hasMore: currentHasMore,
        isLoadingChats,
        isLoadingMessages,
        typingMap: activeTypingMap,
        typingUsernames,
        isChatTyping,
        getChatTypingUsernames,
        getMemberUsername,
        loadChats,
        selectChat,
        loadMoreMessages,
        sendMessage,
        sendTyping,
        markChatAsRead,
        createDirectChat,
        createGroupChat,
        updateChatAvatar,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
