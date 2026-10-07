import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider, useUI } from './context/UIContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';

import { AuthScreen } from './components/auth/AuthScreen';
import { SidebarHeader } from './components/sidebar/SidebarHeader';
import { ChatList } from './components/sidebar/ChatList';
import { ChatHeader } from './components/chat/ChatHeader';
import { MessageList } from './components/chat/MessageList';
import { ChatInput } from './components/chat/ChatInput';
import { EmptyChatState } from './components/chat/EmptyChatState';

import { ToastContainer } from './components/common/Toast';
import { NewDirectModal } from './components/modals/NewDirectModal';
import { NewGroupModal } from './components/modals/NewGroupModal';
import { ChatDetailsModal } from './components/modals/ChatDetailsModal';
import { ProfileModal } from './components/modals/ProfileModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { MediaPickerModal } from './components/media/MediaPickerModal';
import { VoiceRecorderModal } from './components/media/VoiceRecorderModal';
import { LightboxModal } from './components/media/LightboxModal';
import { InstallBanner } from './components/pwa/InstallBanner';

const MessengerShell: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { mobileView } = useUI();
  const { activeChatId } = useChat();

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0b141a]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse mb-4">
          <svg className="w-9 h-9 text-white" viewBox="0 0 100 100" fill="currentColor">
            <path d="M30 65 V35 Q30 30 35 30 H65 Q70 30 70 35 V55 Q70 60 65 60 H42 L30 70 Z" opacity="0.95"/>
            <circle cx="43" cy="45" r="4" fill="#059669"/>
            <circle cx="52" cy="45" r="4" fill="#059669"/>
            <circle cx="61" cy="45" r="4" fill="#059669"/>
          </svg>
        </div>
        <p className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
          Загрузка Cell...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="h-full w-full flex overflow-hidden safe-top safe-bottom">
      {/* Sidebar (List of chats) */}
      <aside
        className={`sidebar-container w-full md:w-96 md:min-w-[340px] md:max-w-[420px] ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <SidebarHeader />
        <ChatList />
      </aside>

      {/* Main Chat Area */}
      <main
        className={`chat-window-container flex-1 ${
          mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeChatId ? (
          <>
            <ChatHeader />
            <MessageList />
            <ChatInput />
          </>
        ) : (
          <EmptyChatState />
        )}
      </main>

      {/* Global Modals & Dialogs */}
      <NewDirectModal />
      <NewGroupModal />
      <ChatDetailsModal />
      <ProfileModal />
      <SettingsModal />
      <MediaPickerModal />
      <VoiceRecorderModal />
      <LightboxModal />
      <InstallBanner />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <UIProvider>
        <AuthProvider>
          <ChatProvider>
            <MessengerShell />
            <ToastContainer />
          </ChatProvider>
        </AuthProvider>
      </UIProvider>
    </ThemeProvider>
  );
};

export default App;
