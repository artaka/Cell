/**
 * Cell Messenger API types
 * Based directly on openapi.json (v1.0.0)
 */

export type ChatType = 'direct' | 'group' | 'channel';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface UserResponse {
  id: string; // UUID
  username: string;
  email: string;
  avatar_url?: string | null;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserPreview {
  id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
}

export interface CreateDirectChatRequest {
  user: string; // target user UUID
}

export interface DirectChatResponse {
  id: string;
  chat_type: ChatType;
  created_at: string;
  user: UserPreview;
}

export interface ExistingChatResponse {
  message: string;
  chat_id: string;
}

export interface CreateGroupChatRequest {
  title: string;
  user_ids: string[];
}

export interface NewChatResponse {
  id: string;
  chat_type: ChatType;
  title: string;
  created_at: string;
}

export interface MessagePreview {
  id: number;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface GetChatListItemResponse {
  id: string;
  type: ChatType;
  title: string;
  avatar_url: string;
  last_message?: MessagePreview;
  unread_count: number;
}

export interface ChatListResponse {
  chats: GetChatListItemResponse[];
}

export interface ChatMemberResponse {
  user_id: string;
  username: string;
  role: MemberRole;
  joined_at: string;
  avatar_url?: string | null;
}

export interface ChatMembersResponse {
  members: ChatMemberResponse[];
}

export interface MessageResponse {
  id: number;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  // UI optimistic extensions
  isPending?: boolean;
  isFailed?: boolean;
  tempId?: string;
  isRead?: boolean;
}

export interface ChatMessagesResponse {
  messages: MessageResponse[];
  next_cursor: number | null;
  has_more: boolean;
}

export interface UserSearchResponse {
  users: UserResponse[];
}

export interface HealthResponse {
  status: string;
}

export interface ErrorResponse {
  error: string;
  sys?: string;
}

export type UploadMediaType = 'image' | 'video' | 'audio' | 'avatar' | 'Chat_avatar';

export interface PhotoOrVideoUploadResponse {
  media_url: string;
  media_type: UploadMediaType | string;
}

/* ================= WebSocket Types ================= */

export type WSActionType = 'message:send' | 'typing' | 'read';
export type WSEventType = 'message:ack' | 'message:new' | 'typing' | 'read' | 'error';

export interface WSClientMessage<T = unknown> {
  action: WSActionType;
  payload: T;
}

export interface WSServerMessage<T = unknown> {
  event: WSEventType;
  payload: T;
}

export interface WSSendMessagePayload {
  client_msg_temp_id: string;
  chat_id: string;
  content: string;
}

export interface WSTypingPayload {
  user_id: string;
  chat_id: string;
  is_typing: boolean;
}

export interface WSReadPayload {
  chat_id: string;
  message_id: number;
}

export interface WSMessageAckPayload {
  client_msg_temp_id: string;
  message_id: number;
  chat_id: string;
  created_at: string;
}

export interface WSNewMessageNotification {
  id: number;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface WSReadNotification {
  user_id: string;
  chat_id: string;
  message_id: number;
}

export interface WSErrorPayload {
  client_msg_temp_id?: string;
  error: string;
}

/* ================= Calls Service Types ================= */

export interface CallParticipant {
  peer_id: string;
  user_id: string;
  username: string;
  joined_at: string;
}

export interface CallRoomResponse {
  room_id: string;
  chat_id: string;
  call_type: 'video' | 'audio';
  initiator_id: string;
  initiator_name: string;
  created_at: string;
  is_active: boolean;
  participants: CallParticipant[];
}

export interface ActiveCallResponse {
  active: boolean;
  chat_id?: string;
  room?: CallRoomResponse;
}

export interface CreateCallRoomRequest {
  chat_id: string;
  type?: 'video' | 'audio';
}

export interface EndCallResponse {
  status: string;
  message: string;
  room_id: string;
}

export interface CallsHealthResponse {
  status: string;
  service: string;
  active_rooms: number;
}
