import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  isLoading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ query, onChange, isLoading = false }) => {
  return (
    <div className="search-box-container">
      <div className="search-input-wrapper">
        <div className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-emerald-500" />
          ) : (
            <Search size={16} />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Поиск диалогов или людей..."
          className="search-input-field"
        />

        {query && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
};
