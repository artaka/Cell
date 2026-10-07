import React from 'react';
import { useUI } from '../../context/UIContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUI();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={18} />,
          error: <AlertCircle className="text-red-500 flex-shrink-0" size={18} />,
          info: <Info className="text-blue-500 flex-shrink-0" size={18} />,
        };

        const bgStyles = {
          success: 'border-emerald-500/30',
          error: 'border-red-500/30',
          info: 'border-blue-500/30',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-[#182229] border shadow-lg animate-modal-in ${bgStyles[toast.type]}`}
          >
            {icons[toast.type]}
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1 leading-relaxed">
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
