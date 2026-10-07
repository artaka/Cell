import { request } from './client';
import {
  ActiveCallResponse,
  CallRoomResponse,
  CreateCallRoomRequest,
  EndCallResponse,
  CallsHealthResponse,
} from './types';

export const callsApi = {
  /**
   * Create or retrieve active call room for chat
   */
  createCallRoom: (data: CreateCallRoomRequest): Promise<CallRoomResponse> => {
    return request<CallRoomResponse>('/api/v1/calls/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get call room details by ID
   */
  getCallRoom: (roomId: string): Promise<CallRoomResponse> => {
    return request<CallRoomResponse>(`/api/v1/calls/rooms/${roomId}`);
  },

  /**
   * Check if there is an active call in the chat
   */
  getActiveCall: (chatId: string): Promise<ActiveCallResponse> => {
    return request<ActiveCallResponse>(`/api/v1/calls/active?chat_id=${encodeURIComponent(chatId)}`);
  },

  /**
   * End call room for all participants
   */
  endCall: (roomId: string): Promise<EndCallResponse> => {
    return request<EndCallResponse>(`/api/v1/calls/rooms/${roomId}/end`, {
      method: 'POST',
    });
  },

  /**
   * CallsService health check
   */
  getHealth: (): Promise<CallsHealthResponse> => {
    return request<CallsHealthResponse>('/api/v1/calls/health');
  },
};
