import React from 'react';
import { useUI } from '../../context/UIContext';
import { MessageSquarePlus, Shield, Zap, Sparkles } from 'lucide-react';

export const EmptyChatState: React.FC = () => {
  const { openDirectModal } = useUI();

  return (
    <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-[#0b141a] text-center select-none border-l border-slate-100 dark:border-[#182229]">
      <div className="max-w-md flex flex-col items-center">
        {/* Animated Brand Emblem */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-6 transform hover:scale-105 transition-transform duration-300">
          <svg className="w-11 h-11 text-white" viewBox="0 0 100 100" fill="currentColor">
            <path d="M30 65 V35 Q30 30 35 30 H65 Q70 30 70 35 V55 Q70 60 65 60 H42 L30 70 Z" opacity="0.95"/>
            <circle cx="43" cy="45" r="4" fill="#059669"/>
            <circle cx="52" cy="45" r="4" fill="#059669"/>
            <circle cx="61" cy="45" r="4" fill="#059669"/>
          </svg>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Cell Web Messenger
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Выберите диалог в списке слева или начните новый разговор с коллегами и друзьями.
        </p>

        <button
          onClick={openDirectModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all"
        >
          <MessageSquarePlus size={18} />
          <span>Начать новый чат</span>
        </button>

        {/* Feature Pills */}
        <div className="grid grid-cols-3 gap-3 mt-12 w-full pt-8 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="flex flex-col items-center p-3 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222e35]">
            <Shield size={18} className="text-emerald-500 mb-1.5" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">JWT защита</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Безопасность</span>
          </div>

          <div className="flex flex-col items-center p-3 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222e35]">
            <Zap size={18} className="text-amber-500 mb-1.5" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">WebSocket</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Реальное время</span>
          </div>

          <div className="flex flex-col items-center p-3 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222e35]">
            <Sparkles size={18} className="text-emerald-400 mb-1.5" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">PWA Ready</span>
            <span className="text-[10px] text-slate-400 mt-0.5">ПК и Смартфон</span>
          </div>
        </div>
      </div>
    </div>
  );
};
