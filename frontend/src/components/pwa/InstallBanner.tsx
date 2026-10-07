import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (!deferredPrompt || isDismissed) return null;

  const handleInstall = () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice: any) => {
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    });
  };

  return (
    <aside
      aria-label="Установка приложения"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-40 p-3.5 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-modal-in"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Download size={20} />
        </div>
        <div>
          <h4 className="text-xs font-bold leading-tight">Установить Cell</h4>
          <p className="text-[11px] text-emerald-100">
            Быстрый доступ с экрана вашего устройства
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-white text-emerald-800 text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-50 transition"
        >
          Установить
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-white/20 rounded-md transition text-white"
          aria-label="Закрыть баннер"
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
};
