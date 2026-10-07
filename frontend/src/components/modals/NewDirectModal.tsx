import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { useChat } from '../../context/ChatContext';
import { chatsApi } from '../../api/chats';
import { UserResponse } from '../../api/types';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Avatar } from '../common/Avatar';
import { Search, MessageSquare, Loader2 } from 'lucide-react';

export const NewDirectModal: React.FC = () => {
  const { isDirectModalOpen, closeDirectModal, showToast } = useUI();
  const { createDirectChat } = useChat();

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isDirectModalOpen) {
      setQuery('');
      setUsers([]);
      return;
    }
  }, [isDirectModalOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setUsers([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await chatsApi.searchUsers(query);
        setUsers(res.users || []);
      } catch (err: any) {
        showToast(err.message || 'Ошибка поиска пользователей', 'error');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, showToast]);

  const handleSelectUser = async (u: UserResponse) => {
    setIsCreating(true);
    try {
      await createDirectChat(u.id);
      closeDirectModal();
      showToast(`Диалог с ${u.username} открыт`, 'success');
    } catch {
      // Error handled in context
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isDirectModalOpen}
      onClose={closeDirectModal}
      title="Новый диалог"
      description="Найдите пользователя по имени или email для начала переписки"
    >
      <div className="flex flex-col gap-4">
        <Input
          type="text"
          placeholder="Введите минимум 2 символа (например: alex)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={
            isSearching ? (
              <Loader2 size={16} className="animate-spin text-emerald-500" />
            ) : (
              <Search size={16} />
            )
          }
          autoFocus
        />

        <div className="max-h-72 overflow-y-auto flex flex-col gap-1 pr-1">
          {query.trim().length >= 2 && users.length === 0 && !isSearching && (
            <p className="text-xs text-slate-400 text-center py-6">
              Пользователи не найдены
            </p>
          )}

          {query.trim().length < 2 && (
            <p className="text-xs text-slate-400 text-center py-6">
              Введите имя или почту для поиска
            </p>
          )}

          {users.map((u) => (
            <div
              key={u.id}
              onClick={() => !isCreating && handleSelectUser(u)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#182229] cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <Avatar name={u.username} size="md" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {u.username}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                </div>
              </div>

              <button
                disabled={isCreating}
                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                title="Начать чат"
              >
                <MessageSquare size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
