import { request } from './client';
import { PhotoOrVideoUploadResponse } from './types';

export const filesApi = {
  /**
   * Загрузка аватара текущего пользователя
   * POST /api/v1/files/avatar
   */
  uploadUserAvatar: async (file: File): Promise<PhotoOrVideoUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<PhotoOrVideoUploadResponse>('/api/v1/files/avatar', {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Загрузка аватара группового чата
   * POST /api/v1/files/chats/{id}/avatar
   */
  uploadGroupChatAvatar: async (chatId: string, file: File): Promise<PhotoOrVideoUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<PhotoOrVideoUploadResponse>(`/api/v1/files/chats/${chatId}/avatar`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Загрузка фото или видео для сообщений
   * POST /api/v1/files/messages/
   */
  uploadMessageMedia: async (file: File): Promise<PhotoOrVideoUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<PhotoOrVideoUploadResponse>('/api/v1/files/messages/', {
      method: 'POST',
      body: formData,
    });
  },
};
