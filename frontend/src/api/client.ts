import { ErrorResponse } from './types';

const TOKEN_KEY = 'cell_jwt_token';
const USER_KEY = 'cell_user_data';

export const tokenStorage = {
  get: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
  set: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  remove: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export class ApiError extends Error {
  status: number;
  sys?: string;

  constructor(message: string, status: number, sys?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.sys = sys;
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    let sysError: string | undefined;

    try {
      const errData: ErrorResponse = await response.json();
      if (errData && errData.error) {
        errorMsg = errData.error;
        sysError = errData.sys;
      }
    } catch {
      // response is not json
    }

    if (response.status === 401) {
      // Token expired or invalid
      tokenStorage.remove();
      window.dispatchEvent(new CustomEvent('cell:unauthorized'));
    }

    throw new ApiError(errorMsg, response.status, sysError);
  }

  // Check if content-type is json
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}
