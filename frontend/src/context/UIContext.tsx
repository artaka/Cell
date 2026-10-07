import React, { createContext, useContext, useState } from 'react';

export type MobileView = 'sidebar' | 'chat';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface UIContextType {
  mobileView: MobileView;
  setMobileView: (view: MobileView) => void;

  // Modals
  isDirectModalOpen: boolean;
  openDirectModal: () => void;
  closeDirectModal: () => void;

  isGroupModalOpen: boolean;
  openGroupModal: () => void;
  closeGroupModal: () => void;

  isProfileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;

  isSettingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;

  isChatDetailsOpen: boolean;
  openChatDetails: () => void;
  closeChatDetails: () => void;

  isMediaPickerOpen: boolean;
  openMediaPicker: () => void;
  closeMediaPicker: () => void;

  isVoiceModalOpen: boolean;
  openVoiceModal: () => void;
  closeVoiceModal: () => void;

  lightboxImageUrl: string | null;
  openLightbox: (url: string) => void;
  closeLightbox: () => void;

  // Toasts
  toasts: ToastItem[];
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  removeToast: (id: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileView, setMobileView] = useState<MobileView>('sidebar');

  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatDetailsOpen, setIsChatDetailsOpen] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <UIContext.Provider
      value={{
        mobileView,
        setMobileView,

        isDirectModalOpen,
        openDirectModal: () => setIsDirectModalOpen(true),
        closeDirectModal: () => setIsDirectModalOpen(false),

        isGroupModalOpen,
        openGroupModal: () => setIsGroupModalOpen(true),
        closeGroupModal: () => setIsGroupModalOpen(false),

        isProfileModalOpen,
        openProfileModal: () => setIsProfileModalOpen(true),
        closeProfileModal: () => setIsProfileModalOpen(false),

        isSettingsModalOpen,
        openSettingsModal: () => setIsSettingsModalOpen(true),
        closeSettingsModal: () => setIsSettingsModalOpen(false),

        isChatDetailsOpen,
        openChatDetails: () => setIsChatDetailsOpen(true),
        closeChatDetails: () => setIsChatDetailsOpen(false),

        isMediaPickerOpen,
        openMediaPicker: () => setIsMediaPickerOpen(true),
        closeMediaPicker: () => setIsMediaPickerOpen(false),

        isVoiceModalOpen,
        openVoiceModal: () => setIsVoiceModalOpen(true),
        closeVoiceModal: () => setIsVoiceModalOpen(false),

        lightboxImageUrl,
        openLightbox: (url: string) => setLightboxImageUrl(url),
        closeLightbox: () => setLightboxImageUrl(null),

        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
