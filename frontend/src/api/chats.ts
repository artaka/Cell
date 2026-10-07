import { request } from './client';
import {
  ChatListResponse,
  ChatMembersResponse,
  ChatMessagesResponse,
  CreateDirectChatRequest,
  CreateGroupChatRequest,
  DirectChatResponse,
  ExistingChatResponse,
  NewChatResponse,
  UserSearchResponse
} from './types';

export const chatsApi = {
  getChatList: async (): Promise<ChatListResponse> => {
    return request<ChatListResponse>('/api/v1/chats/list', {
      method: 'GET'
    });
  },

  searchUsers: async (q: string): Promise<UserSearchResponse> => {
    const encoded = encodeURIComponent(q.trim());
    return request<UserSearchResponse>(`/api/v1/chats/users/search?q=${encoded}`, {
      method: 'GET'
    });
  },

  createDirectChat: async (data: CreateDirectChatRequest): Promise<DirectChatResponse | ExistingChatResponse> => {
    return request<DirectChatResponse | ExistingChatResponse>('/api/v1/chats/direct', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  createGroupChat: async (data: CreateGroupChatRequest): Promise<NewChatResponse> => {
    return request<NewChatResponse>('/api/v1/chats/group', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getChatMembers: async (chatId: string): Promise<ChatMembersResponse> => {
    return request<ChatMembersResponse>(`/api/v1/chats/${chatId}/members`, {
      method: 'GET'
    });
  },

  getChatMessages: async (chatId: string, cursor?: number, limit = 30): Promise<ChatMessagesResponse> => {
    const params = new URLSearchParams();
    if (cursor !== undefined && cursor !== null) {
      params.append('cursor', cursor.toString());
    }
    if (limit) {
      params.append('limit', limit.toString());
    }
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return request<ChatMessagesResponse>(`/api/v1/chats/${chatId}/messages${queryStr}`, {
      method: 'GET'
    });
  }
};
