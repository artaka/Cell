import { request } from './client';
import { AuthResponse, LoginRequest, RegisterRequest, UserResponse, HealthResponse } from './types';

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getUserById: async (id: string): Promise<UserResponse> => {
    return request<UserResponse>(`/api/v1/users/${id}`, {
      method: 'GET',
    });
  },

  getHealth: async (): Promise<HealthResponse> => {
    return request<HealthResponse>('/api/v1/health', {
      method: 'GET',
    });
  }
};
