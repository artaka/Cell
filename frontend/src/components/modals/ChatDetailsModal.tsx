import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../../context/UIContext';
import { useChat } from '../../context/ChatContext';
import { chatsApi } from '../../api/chats';
import { filesApi } from '../../api/files';
import { ChatMemberResponse, UserResponse } from '../../api/types';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Avatar } from '../common/Avatar';
import {
  Crown,
  Shield,
  User,
  Users,
  UserPlus,
  Bell,
  BellOff,
  Sparkles,
  Search,
  Check,
  Plus,
  Loader2,
  X,
  Camera
} from 'lucide-react';

export const ChatDetailsModal: React.FC = () => {
  const { isChatDetailsOpen, closeChatDetails, showToast } = useUI();
  const { activeChat, updateChatAvatar } = useChat();

  const [members, setMembers] = useState<ChatMemberResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Add member by username search state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserResponse[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  useEffect(() => {
    if (isChatDetailsOpen && activeChat && activeChat.type === 'group') {
      setIsLoading(true);
      chatsApi
        .getChatMembers(activeChat.id)
        .then((res) => {
          setMembers(res.members || []);
        })
        .catch((err) => {
          console.warn('[ChatDetails] Members error:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setMembers([]);
      setIsAddingMember(false);
      setUserSearchQuery('');
      setUserSearchResults([]);
    }
  }, [isChatDetailsOpen, activeChat]);

  // Search users by username
  useEffect(() => {
    if (userSearchQuery.trim().length < 2) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await chatsApi.searchUsers(userSearchQuery.trim());
        setUserSearchResults(res.users || []);
      } catch {
        // error
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  if (!activeChat) return null;

  const isGroup = activeChat.type === 'group';

  const handleAddUserToGroup = (targetUser: UserResponse) => {
    // Check if user is already in group
    if (members.some((m) => m.user_id === targetUser.id || m.username === targetUser.username)) {
      showToast(`Пользователь @${targetUser.username} уже состоит в этой группе`, 'info');
      return;
    }

    // Add locally to members list with feedback
    const newMember: ChatMemberResponse = {
      user_id: targetUser.id,
      username: targetUser.username,
      role: 'member',
      joined_at: new Date().toISOString(),
    };

    setMembers((prev) => [...prev, newMember]);
    showToast(`Пользователь @${targetUser.username} добавлен в группу!`, 'success');
    setUserSearchQuery('');
    setUserSearchResults([]);
    setIsAddingMember(false);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="role-badge-owner flex items-center gap-1">
            <Crown size={11} />
            <span>Владелец</span>
          </span>
        );
      case 'admin':
        return (
          <span className="role-badge-admin flex items-center gap-1">
            <Shield size={11} />
            <span>Админ</span>
          </span>
        );
      default:
        return (
          <span className="role-badge-member flex items-center gap-1">
            <User size={11} />
            <span>Участник</span>
          </span>
        );
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    if (file.size > 50 * 1024 * 1024) {
      showToast('Размер файла превышает 50 МБ', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await filesApi.uploadGroupChatAvatar(activeChat.id, file);
      updateChatAvatar(activeChat.id, res.media_url);
      showToast('Аватар группы успешно обновлен', 'success');
    } catch (err: any) {
      console.error('[GroupAvatar] Upload error:', err);
      showToast(err.message || 'Ошибка загрузки аватара группы', 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (groupAvatarInputRef.current) {
        groupAvatarInputRef.current.value = '';
      }
    }
  };

  return (
    <Modal
      isOpen={isChatDetailsOpen}
      onClose={closeChatDetails}
      title={isGroup ? 'Информация о группе' : 'Данные собеседника'}
    >
      <div className="flex flex-col gap-4">
        {/* Profile Card Header */}
        <div className="flex flex-col items-center p-4 bg-slate-50 dark:bg-[#182229] rounded-2xl border border-slate-200 dark:border-[#222e35]">
          <div className="relative mb-3">
            <Avatar
              id={activeChat.id}
              name={activeChat.title}
              imageUrl={activeChat.avatar_url || null}
              size="xl"
            />
            {isGroup && (
              <>
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => groupAvatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 text-white rounded-full shadow hover:bg-emerald-700 transition disabled:opacity-50"
                  title="Сменить аватар группы"
                >
                  {isUploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                </button>
                <input
                  ref={groupAvatarInputRef}
                  type="file"
                  onChange={handleGroupAvatarUpload}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />
              </>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 text-center">
            {activeChat.title}
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            ID: {activeChat.id}
          </p>
        </div>

        {/* Quick Settings Toggles */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35]">
          <div className="flex items-center gap-2.5">
            {isMuted ? <BellOff size={18} className="text-slate-400" /> : <Bell size={18} className="text-emerald-500" />}
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Уведомления
              </p>
              <p className="text-[10px] text-slate-400">
                {isMuted ? 'Отключены' : 'Включены'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {isMuted ? 'Включить' : 'Без звука'}
          </button>
        </div>

        {/* Members section for Group Chats */}
        {isGroup && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users size={14} />
                <span>Участники ({members.length})</span>
              </span>

              {/* Add member by username trigger */}
              <button
                onClick={() => setIsAddingMember(!isAddingMember)}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                {isAddingMember ? (
                  <>
                    <X size={13} />
                    <span>Скрыть поиск</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} />
                    <span>+ Добавить по юзернейму</span>
                  </>
                )}
              </button>
            </div>

            {/* Inline search to add member by username */}
            {isAddingMember && (
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50 flex flex-col gap-2 animate-modal-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    Поиск пользователя по юзернейму
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Без ввода UUID
                  </span>
                </div>

                <Input
                  placeholder="Введите юзернейм (например: alex)..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  leftIcon={
                    isSearchingUsers ? (
                      <Loader2 size={15} className="animate-spin text-emerald-500" />
                    ) : (
                      <Search size={15} />
                    )
                  }
                  autoFocus
                />

                {userSearchQuery.trim().length >= 2 && (
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1 bg-white dark:bg-[#182229] rounded-lg p-1.5 border border-slate-200 dark:border-[#222e35]">
                    {userSearchResults.length === 0 && !isSearchingUsers ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        Пользователь "@{userSearchQuery}" не найден
                      </p>
                    ) : (
                      userSearchResults.map((u) => {
                        const isAlreadyMember = members.some(
                          (m) => m.user_id === u.id || m.username === u.username
                        );
                        return (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-[#202c33]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar name={u.username} size="sm" />
                              <div className="truncate">
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  @{u.username}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1.5 truncate">
                                  {u.email}
                                </span>
                              </div>
                            </div>

                            {isAlreadyMember ? (
                              <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                В группе
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddUserToGroup(u)}
                                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-md transition flex items-center gap-1 shadow-sm"
                              >
                                <Plus size={13} />
                                <span>Добавить</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Members List */}
            <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-1 border border-slate-200 dark:border-[#222e35] rounded-xl p-2 bg-slate-50/50 dark:bg-[#182229]/50">
              {isLoading ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Загрузка участников...
                </p>
              ) : members.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Список участников недоступен
                </p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-[#202c33] transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.username} imageUrl={m.avatar_url || null} size="sm" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          @{m.username}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          В чате с {new Date(m.joined_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                    {getRoleBadge(m.role)}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Feature status banner */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] flex items-center justify-between opacity-80">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Экспорт истории и общие медиа
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            Скоро
          </span>
        </div>
      </div>
    </Modal>
  );
};
