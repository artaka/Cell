import React from 'react';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'compact' }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        title={`Текущая тема: ${resolvedTheme === 'dark' ? 'Тёмная' : 'Светлая'} (нажмите для смены)`}
        aria-label="Сменить тему"
      >
        {resolvedTheme === 'dark' ? <Moon size={18} className="text-emerald-400" /> : <Sun size={18} className="text-amber-500" />}
      </button>
    );
  }

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Светлая', icon: <Sun size={15} /> },
    { mode: 'system', label: 'Авто', icon: <Monitor size={15} /> },
    { mode: 'dark', label: 'Тёмная', icon: <Moon size={15} /> },
  ];

  return (
    <div className="inline-flex p-1 bg-slate-100 dark:bg-[#182229] rounded-xl border border-slate-200 dark:border-[#222e35]">
      {options.map((opt) => {
        const isActive = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            onClick={() => setTheme(opt.mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              isActive
                ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
