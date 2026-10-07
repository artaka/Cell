import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { filesApi } from '../../api/files';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { Camera, Copy, Check, Sparkles, User, Mail, ShieldAlert, Key, Loader2 } from 'lucide-react';

export const ProfileModal: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const { isProfileModalOpen, closeProfileModal, showToast } = useUI();

  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState('На связи в Cell 🚀');
  const [copiedId, setCopiedId] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (!user) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    showToast('ID пользователя скопирован', 'info');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      showToast('Размер файла превышает 50 МБ', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await filesApi.uploadUserAvatar(file);
      updateLocalUser({ avatar_url: res.media_url });
      showToast('Аватар успешно обновлен', 'success');
    } catch (err: any) {
      console.error('[AvatarUpload] Error:', err);
      showToast(err.message || 'Ошибка загрузки аватара', 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast('Имя пользователя не может быть пустым', 'error');
      return;
    }

    updateLocalUser({ username: username.trim() });
    showToast('Профиль успешно обновлен!', 'success');
    setActiveTab('view');
  };

  return (
    <Modal
      isOpen={isProfileModalOpen}
      onClose={closeProfileModal}
      title="Мой профиль"
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {/* Tab switch */}
        <div className="flex border-b border-slate-200 dark:border-[#222e35] -mt-2">
          <button
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'view'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Просмотр
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'edit'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Редактировать
          </button>
        </div>

        {activeTab === 'view' ? (
          <div className="flex flex-col gap-4">
            {/* Avatar & user summary */}
            <div className="flex flex-col items-center p-5 rounded-2xl bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35]">
              <div className="relative mb-3">
                <Avatar name={user.username} imageUrl={user.avatar_url || null} size="xl" isOnline={true} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {user.username}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {user.email}
              </p>
              <span className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
                {bio}
              </span>
            </div>

            {/* Info details */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222e35]">
                <div className="flex items-center gap-2.5">
                  <User size={16} className="text-emerald-500" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">
                      Имя пользователя
                    </p>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      @{user.username}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222e35]">
                <div className="flex items-center gap-2.5">
                  <Mail size={16} className="text-emerald-500" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">
                      Электронная почта
                    </p>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222e35]">
                <div className="flex items-center gap-2.5">
                  <Key size={16} className="text-emerald-500" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">
                      UUID пользователя
                    </p>
                    <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {user.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCopyId}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  title="Скопировать UUID"
                >
                  {copiedId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveTab('edit')}
              className="w-full mt-1"
            >
              Редактировать профиль
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            {/* Banner about preview */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-start gap-2.5">
              <Sparkles size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>Предпросмотр интерфейса:</strong> Вы можете протестировать изменение данных. Они обновятся локально в сессии приложения.
              </p>
            </div>

            {/* Avatar upload */}
            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-[#182229] rounded-xl border border-slate-200 dark:border-[#222e35]">
              <div className="relative">
                <Avatar name={username || user.username} imageUrl={user.avatar_url || null} size="lg" />
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 text-white rounded-full shadow hover:bg-emerald-700 transition disabled:opacity-50"
                  title="Загрузить аватар (JPG, PNG, до 50МБ)"
                >
                  {isUploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  onChange={handleAvatarFileSelected}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Аватар профиля
                </p>
                <p className="text-[11px] text-slate-400">
                  {isUploadingAvatar ? 'Загрузка в S3 хранилище...' : 'Поддерживаются JPG, PNG, WEBP, GIF (до 50 МБ)'}
                </p>
              </div>
            </div>

            <Input
              label="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alex_smith"
              required
            />

            <Input
              label="Статус / О себе"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Например: Доступен для связи..."
            />

            {/* Change password preview */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#222e35] flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <ShieldAlert size={14} />
                <span>Смена пароля</span>
              </span>
              <Input
                type="password"
                placeholder="Текущий пароль"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Новый пароль (минимум 8 символов)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setActiveTab('view')}
              >
                Отмена
              </Button>
              <Button type="submit" variant="primary" size="md">
                Сохранить изменения
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
