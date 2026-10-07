import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { useChat } from '../../context/ChatContext';
import { chatsApi } from '../../api/chats';
import { UserResponse } from '../../api/types';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { Search, X, Check, Users, Loader2, Sparkles, UserCheck, Plus } from 'lucide-react';

export const NewGroupModal: React.FC = () => {
  const { isGroupModalOpen, closeGroupModal, showToast } = useUI();
  const { createGroupChat, chats } = useChat();

  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResponse[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Suggestions from existing direct chats
  const suggestedContacts: { username: string; id: string }[] = chats
    .filter((c) => c.type === 'direct' && c.title)
    .map((c) => ({
      username: c.title,
      // For direct chats, c.id is chat_id; we will search or use when matching
      id: c.id,
    }));

  useEffect(() => {
    if (!isGroupModalOpen) {
      setTitle('');
      setQuery('');
      setSearchResults([]);
      setSelectedUsers([]);
    }
  }, [isGroupModalOpen]);

  // Search users by username / email
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await chatsApi.searchUsers(query.trim());
        setSearchResults(res.users || []);
      } catch (err: any) {
        console.warn('[GroupSearch] Error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const toggleUserSelection = (u: UserResponse) => {
    if (selectedUsers.some((x) => x.id === u.id)) {
      setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id));
    } else {
      setSelectedUsers((prev) => [...prev, u]);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If there are search results, select the first one
      if (searchResults.length > 0) {
        toggleUserSelection(searchResults[0]);
        setQuery('');
      }
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Введите название группы', 'error');
      return;
    }

    if (selectedUsers.length === 0) {
      showToast('Добавьте хотя бы одного участника по юзернейму', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Map user models to their IDs internally (UUID is never typed by user)
      const userIds = selectedUsers.map((u) => u.id);
      await createGroupChat(title.trim(), userIds);
      showToast(`Группа "${title.trim()}" успешно создана!`, 'success');
      closeGroupModal();
    } catch (e: any) {
      showToast(e.message || 'Ошибка создания группы', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isGroupModalOpen}
      onClose={closeGroupModal}
      title="Создание группового чата"
      description="Укажите название и выберите участников по юзернейму"
    >
      <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
        <Input
          label="Название группы"
          placeholder="Например: Проект Cell, Команда..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Selected users chips */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Выбрано участников: {selectedUsers.length}
              </span>
              <button
                type="button"
                onClick={() => setSelectedUsers([])}
                className="text-[11px] text-slate-400 hover:text-red-500 transition"
              >
                Очистить всех
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] max-h-24 overflow-y-auto">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium border border-emerald-300/40"
                >
                  <Avatar name={u.username} size="sm" className="w-4 h-4 text-[9px]" />
                  <span>@{u.username}</span>
                  <button
                    type="button"
                    onClick={() => toggleUserSelection(u)}
                    className="hover:text-red-500 transition ml-0.5"
                    title={`Удалить @${u.username}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search for users by username */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Поиск участников по юзернейму
            </label>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Без UUID • Ищет по @username
            </span>
          </div>

          <Input
            placeholder="Введите имя пользователя (например: alex, jane)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            leftIcon={
              isSearching ? (
                <Loader2 size={16} className="animate-spin text-emerald-500" />
              ) : (
                <Search size={16} />
              )
            }
          />
        </div>

        {/* Results List or Suggestions */}
        <div className="flex flex-col gap-1 border border-slate-200 dark:border-[#222e35] rounded-xl p-2 bg-slate-50/50 dark:bg-[#182229]/50 max-h-52 overflow-y-auto">
          {query.trim().length >= 2 ? (
            searchResults.length === 0 && !isSearching ? (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400">
                  Пользователь с юзернеймом "{query}" не найден
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Проверьте правильность написания имени
                </p>
              </div>
            ) : (
              searchResults.map((u) => {
                const isSelected = selectedUsers.some((x) => x.id === u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUserSelection(u)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/50'
                        : 'hover:bg-white dark:hover:bg-[#202c33]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.username} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            @{u.username}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-300 dark:border-slate-600 text-slate-400 hover:text-emerald-500'
                      }`}
                    >
                      {isSelected ? <Check size={14} /> : <Plus size={14} />}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div className="py-2 px-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 px-1">
                Подсказка
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-1">
                Начните вводить юзернейм в поле выше (от 2 символов). Система моментально найдет пользователей в базе данных, и вы сможете добавить их одним кликом.
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          className="w-full mt-1"
        >
          <Users size={16} />
          <span>Создать группу ({selectedUsers.length} уч.)</span>
        </Button>
      </form>
    </Modal>
  );
};
