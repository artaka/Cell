import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { useTheme } from '../../context/ThemeContext';
import { sound } from '../../utils/sound';
import { authApi } from '../../api/auth';
import { wsService, ConnectionStatus } from '../../ws/websocketService';
import { Modal } from '../common/Modal';
import { ThemeToggle } from '../common/ThemeToggle';
import { Button } from '../common/Button';
import {
  Palette,
  Volume2,
  VolumeX,
  Bell,
  Download,
  Activity,
  CheckCircle,
  HelpCircle,
  Smartphone,
  Info
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal, showToast } = useUI();
  const { theme, resolvedTheme } = useTheme();

  const [soundMuted, setSoundMuted] = useState(sound.getMuted());
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>(wsService.getStatus());
  const [healthStatus, setHealthStatus] = useState<string>('Проверка...');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Listen for PWA beforeinstallprompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (isSettingsModalOpen) {
      setWsStatus(wsService.getStatus());
      authApi
        .getHealth()
        .then((res) => setHealthStatus(res.status))
        .catch(() => setHealthStatus('Недоступен'));
    }
  }, [isSettingsModalOpen]);

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    sound.setMuted(next);
    if (!next) {
      sound.playIncomingMessage();
    }
    showToast(next ? 'Звук сообщений выключен' : 'Звук сообщений включен', 'info');
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      showToast('Уведомления не поддерживаются вашим браузером', 'error');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        showToast('Уведомления успешно включены!', 'success');
      } else {
        showToast('Разрешение на уведомления отклонено', 'info');
      }
    } catch {
      showToast('Не удалось запросить разрешение', 'error');
    }
  };

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          showToast('Приложение установлено!', 'success');
        }
        setDeferredPrompt(null);
      });
    } else {
      showToast(
        'Чтобы установить Cell, используйте функцию "Добавить на главный экран" в меню браузера',
        'info'
      );
    }
  };

  return (
    <Modal
      isOpen={isSettingsModalOpen}
      onClose={closeSettingsModal}
      title="Настройки"
      maxWidth="md"
    >
      <div className="flex flex-col gap-5">
        {/* Appearance & Themes */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Palette size={15} />
            <span>Тема оформления (Бело-зеленая)</span>
          </span>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Цветовая схема
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Автоматически по системе либо светлая / тёмная
              </p>
            </div>
            <ThemeToggle variant="segmented" />
          </div>
        </div>

        {/* Notifications and Sounds */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Volume2 size={15} />
            <span>Звуки и уведомления</span>
          </span>

          <div className="flex flex-col gap-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {soundMuted ? (
                  <VolumeX size={17} className="text-slate-400" />
                ) : (
                  <Volume2 size={17} className="text-emerald-500" />
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Звуковые эффекты
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Звуковой сигнал при входящих и отправке
                  </p>
                </div>
              </div>

              <button
                onClick={toggleSound}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  !soundMuted ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    !soundMuted ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell size={17} className="text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Push-уведомления
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Статус: {notificationPermission === 'granted' ? 'Разрешено' : 'Не включено'}
                  </p>
                </div>
              </div>

              {notificationPermission !== 'granted' && (
                <button
                  onClick={requestNotifications}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Включить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PWA & System info */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Smartphone size={15} />
            <span>PWA и статус системы</span>
          </span>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-emerald-500" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Статус бэкенда API:
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {healthStatus}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  WebSocket соединение:
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {wsStatus}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleInstallPWA}
                className="w-full"
              >
                <Download size={14} />
                <span>Установить приложение Cell на устройство (PWA)</span>
              </Button>
            </div>
          </div>
        </div>

        {/* About App */}
        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-[#182229]/60 border border-slate-200 dark:border-[#222e35] flex items-center gap-2.5 text-slate-500">
          <Info size={16} className="flex-shrink-0 text-emerald-600" />
          <p className="text-[11px] leading-relaxed">
            <strong>Cell Messenger</strong> v1.0.0 • Go Gin WebSocket Backend • React PWA Client. Все права защищены.
          </p>
        </div>
      </div>
    </Modal>
  );
};
