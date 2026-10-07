import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { Avatar } from '../common/Avatar';
import { ThemeToggle } from '../common/ThemeToggle';
import {
  MessageSquarePlus,
  Users,
  Settings,
  User,
  LogOut,
  MoreVertical,
} from 'lucide-react';

export const SidebarHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const { openDirectModal, openGroupModal, openProfileModal, openSettingsModal } = useUI();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <header className="sidebar-header">
      {/* User profile preview */}
      <button
        onClick={openProfileModal}
        className="flex items-center gap-3 text-left p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-[#182229] transition group"
        title="Открыть мой профиль"
      >
        <Avatar name={user.username} imageUrl={user.avatar_url || null} size="md" isOnline={true} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
            {user.username}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
            {user.email}
          </span>
        </div>
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={openDirectModal}
          className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
          title="Написать сообщение / Найти людей"
        >
          <MessageSquarePlus size={19} />
        </button>

        <button
          onClick={openGroupModal}
          className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
          title="Создать групповой чат"
        >
          <Users size={19} />
        </button>

        <ThemeToggle />

        {/* Dropdown menu */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
            title="Меню"
          >
            <MoreVertical size={19} />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] rounded-xl shadow-xl z-50 py-1.5 animate-modal-in">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    openProfileModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202c33] transition"
                >
                  <User size={15} />
                  <span>Мой профиль</span>
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    openSettingsModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202c33] transition"
                >
                  <Settings size={15} />
                  <span>Настройки</span>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-[#222e35]" />

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                >
                  <LogOut size={15} />
                  <span>Выйти из аккаунта</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
