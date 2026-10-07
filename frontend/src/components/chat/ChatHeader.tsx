import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useUI } from '../../context/UIContext';
import { Avatar } from '../common/Avatar';
import { ArrowLeft, Phone, Video, Info, Users, PhoneCall } from 'lucide-react';
import { callsApi } from '../../api/calls';
import { formatCallMessage } from '../../utils/mediaParser';
import { CallModal } from './CallModal';
import { CallRoomResponse } from '../../api/types';

export const ChatHeader: React.FC = () => {
  const { activeChat, typingMap, isChatTyping, typingUsernames, sendMessage } = useChat();
  const { setMobileView, openChatDetails, showToast } = useUI();

  const [activeCallRoom, setActiveCallRoom] = useState<CallRoomResponse | null>(null);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [callModalType, setCallModalType] = useState<'video' | 'audio'>('video');
  const [currentRoomId, setCurrentRoomId] = useState<string | undefined>(undefined);

  // Poll / check for active call in this chat
  useEffect(() => {
    if (!activeChat) {
      setActiveCallRoom(null);
      return;
    }

    let isMounted = true;
    const checkActiveCall = async () => {
      try {
        const res = await callsApi.getActiveCall(activeChat.id);
        if (isMounted) {
          if (res.active && res.room) {
            setActiveCallRoom(res.room);
          } else {
            setActiveCallRoom(null);
          }
        }
      } catch {
        // CallsService may be offline or no active call
      }
    };

    checkActiveCall();
    const interval = setInterval(checkActiveCall, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeChat?.id]);

  if (!activeChat) return null;

  const isGroup = activeChat.type === 'group';
  const isTyping = isChatTyping(activeChat.id) || Object.values(typingMap).some(Boolean);

  let typingLabel = 'печатает';
  if (typingUsernames.length === 1) {
    typingLabel = isGroup ? `${typingUsernames[0]} печатает` : 'печатает';
  } else if (typingUsernames.length === 2) {
    typingLabel = `${typingUsernames[0]} и ${typingUsernames[1]} печатают`;
  } else if (typingUsernames.length > 2) {
    typingLabel = `${typingUsernames[0]} и ещё ${typingUsernames.length - 1} печатают`;
  }

  const handleStartCall = async (type: 'audio' | 'video') => {
    setCallModalType(type);
    setIsCalling(true);

    try {
      const room = await callsApi.createCallRoom({
        chat_id: activeChat.id,
        type,
      });

      setCurrentRoomId(room.room_id);
      setActiveCallRoom(room);

      // Post notification in chat history
      await sendMessage(formatCallMessage(room.room_id, type, 'started'));
    } catch (err: any) {
      console.warn('REST createCallRoom notice (WebSocket fallback will create room):', err);
    }
  };

  const handleJoinActiveCall = () => {
    if (!activeCallRoom) return;
    setCurrentRoomId(activeCallRoom.room_id);
    setCallModalType(activeCallRoom.call_type);
    setIsCalling(true);
  };

  return (
    <>
      <header className="chat-header-bar">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile back button */}
          <button
            onClick={() => setMobileView('sidebar')}
            className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#182229] transition"
            aria-label="Назад к списку чатов"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Chat Avatar & Title */}
          <button
            onClick={openChatDetails}
            className="flex items-center gap-3 text-left min-w-0 group"
            title="Информация о чате"
          >
            <Avatar
              id={activeChat.id}
              name={activeChat.title}
              imageUrl={activeChat.avatar_url || null}
              size="md"
            />
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                {activeChat.title}
              </h3>

              {isTyping ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span className="truncate max-w-[200px] sm:max-w-[320px]">{typingLabel}</span>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                  {isGroup ? (
                    <>
                      <Users size={11} />
                      <span>Групповой чат</span>
                    </>
                  ) : (
                    <span>В сети</span>
                  )}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Action buttons & Active Call Indicator */}
        <div className="flex items-center gap-2">
          {/* Active Call Banner */}
          {activeCallRoom && !isCalling && (
            <button
              onClick={handleJoinActiveCall}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full hover:bg-emerald-600/25 transition animate-pulse"
            >
              <PhoneCall size={13} />
              <span>Идет звонок ({activeCallRoom.participants?.length || 1})</span>
              <span className="font-bold underline ml-0.5">Войти</span>
            </button>
          )}

          <button
            onClick={() => handleStartCall('audio')}
            className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
            title="Начать аудиозвонок"
          >
            <Phone size={18} />
          </button>

          <button
            onClick={() => handleStartCall('video')}
            className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
            title="Начать видеозвонок"
          >
            <Video size={18} />
          </button>

          <button
            onClick={openChatDetails}
            className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
            title="Данные чата"
          >
            <Info size={19} />
          </button>
        </div>
      </header>

      {/* Floating / Fullscreen Call Modal */}
      {isCalling && (
        <CallModal
          chatId={activeChat.id}
          chatTitle={activeChat.title}
          roomId={currentRoomId}
          callType={callModalType}
          onClose={() => {
            setIsCalling(false);
            setCurrentRoomId(undefined);
          }}
        />
      )}
    </>
  );
};
