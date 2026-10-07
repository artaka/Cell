import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ThemeToggle } from '../common/ThemeToggle';
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const { showToast } = useUI();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errs: { username?: string; email?: string; password?: string } = {};

    if (mode === 'register') {
      if (!username.trim() || username.trim().length < 3) {
        errs.username = 'Имя пользователя должно содержать не менее 3 символов';
      } else if (username.trim().length > 32) {
        errs.username = 'Имя пользователя не должно превышать 32 символа';
      }
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Введите корректный email адрес';
    }

    if (!password || password.length < 8) {
      errs.password = 'Пароль должен содержать минимум 8 символов';
    } else if (password.length > 32) {
      errs.password = 'Пароль не должен превышать 32 символа';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login({
          email: email.trim(),
          password,
        });
        showToast('Добро пожаловать в Cell!', 'success');
      } else {
        await register({
          username: username.trim(),
          email: email.trim(),
          password,
        });
        showToast('Аккаунт успешно создан!', 'success');
      }
    } catch (err: any) {
      const msg = err.message || 'Ошибка аутентификации';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Top right theme toggle */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="auth-card">
        {/* Header branding */}
        <div className="p-6 text-center border-b border-slate-100 dark:border-[#222e35]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20 mb-3">
            <svg className="w-8 h-8 text-white" viewBox="0 0 100 100" fill="currentColor">
              <path d="M30 65 V35 Q30 30 35 30 H65 Q70 30 70 35 V55 Q70 60 65 60 H42 L30 70 Z" opacity="0.95"/>
              <circle cx="43" cy="45" r="4" fill="#059669"/>
              <circle cx="52" cy="45" r="4" fill="#059669"/>
              <circle cx="61" cy="45" r="4" fill="#059669"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cell Messenger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login'
              ? 'Войдите в свой аккаунт для продолжения общения'
              : 'Создайте учетную запись для безопасного общения'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs-container">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setErrors({});
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setErrors({});
            }}
          >
            Регистрация
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {mode === 'register' && (
            <Input
              label="Имя пользователя"
              type="text"
              name="username"
              placeholder="alex_smith"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={errors.username}
              leftIcon={<User size={16} />}
              autoComplete="username"
              required
            />
          )}

          <Input
            label="Электронная почта"
            type="email"
            name="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            leftIcon={<Mail size={16} />}
            autoComplete="email"
            required
          />

          <Input
            label="Пароль"
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            leftIcon={<Lock size={16} />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="w-full mt-2"
          >
            <ShieldCheck size={18} />
            <span>{mode === 'login' ? 'Войти в аккаунт' : 'Зарегистрироваться'}</span>
          </Button>

          <div className="text-center mt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'Еще нет аккаунта?' : 'Уже зарегистрированы?'}
            </span>{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setErrors({});
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {mode === 'login' ? 'Создать аккаунт' : 'Войти'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
