import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { tokenStorage } from '../api/client';
import { LoginRequest, RegisterRequest, UserResponse } from '../api/types';
import { wsService } from '../ws/websocketService';

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateLocalUser: (data: Partial<UserResponse>) => void;
}

const USER_STORAGE_KEY = 'cell_user_data';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = tokenStorage.get();
      if (savedToken && user) {
        setToken(savedToken);
        wsService.connect(savedToken);
        // Silently verify user
        try {
          const freshUser = await authApi.getUserById(user.id);
          setUser(freshUser);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
        } catch (e) {
          console.warn('[Auth] Token check warning:', e);
        }
      } else {
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('cell:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('cell:unauthorized', handleUnauthorized);
  }, []);

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(data);
      tokenStorage.set(res.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      wsService.connect(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const res = await authApi.register(data);
      tokenStorage.set(res.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      wsService.connect(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    tokenStorage.remove();
    setToken(null);
    setUser(null);
    wsService.disconnect();
  };

  const updateLocalUser = (data: Partial<UserResponse>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        updateLocalUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
