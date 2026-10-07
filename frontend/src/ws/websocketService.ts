import {
  WSActionType,
  WSClientMessage,
  WSEventType,
  WSMessageAckPayload,
  WSNewMessageNotification,
  WSReadNotification,
  WSTypingPayload,
  WSErrorPayload
} from '../api/types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type WSEventCallbackMap = {
  'message:ack': (payload: WSMessageAckPayload) => void;
  'message:new': (payload: WSNewMessageNotification) => void;
  'typing': (payload: WSTypingPayload) => void;
  'read': (payload: WSReadNotification) => void;
  'error': (payload: WSErrorPayload) => void;
  'status': (status: ConnectionStatus) => void;
};

class WebSocketService {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private pendingQueue: string[] = [];

  constructor() {
    this.listeners.set('message:ack', new Set());
    this.listeners.set('message:new', new Set());
    this.listeners.set('typing', new Set());
    this.listeners.set('read', new Set());
    this.listeners.set('error', new Set());
    this.listeners.set('status', new Set());
  }

  public connect(token: string) {
    if (!token) return;
    this.token = token;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // In dev or prod, goes through proxy /api/v1/ws/
    const wsUrl = `${protocol}//${host}/api/v1/ws/?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.flushPendingQueue();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data) return;

          // 1. Standard format: { event: "...", payload: { ... } }
          if (data.event) {
            const payload = data.payload !== undefined ? data.payload : data;
            this.emit(data.event as WSEventType, payload);
            return;
          }

          // 2. Direct typing packet from Go server: { user_id, chat_id, is_typing }
          if ('is_typing' in data && 'chat_id' in data) {
            this.emit('typing', {
              user_id: data.user_id,
              chat_id: data.chat_id,
              is_typing: Boolean(data.is_typing),
            });
            return;
          }

          // 3. Direct read notification from Go server: { user_id, chat_id, message_id }
          if ('message_id' in data && 'chat_id' in data && 'user_id' in data && !('content' in data)) {
            this.emit('read', {
              user_id: data.user_id,
              chat_id: data.chat_id,
              message_id: Number(data.message_id),
            });
            return;
          }

          // 4. Direct new message notification: { id, chat_id, sender_id, content, created_at }
          if ('id' in data && 'chat_id' in data && 'content' in data && 'sender_id' in data) {
            this.emit('message:new', data);
            return;
          }

          // 5. Direct message:ack packet: { client_msg_temp_id, message_id, chat_id, created_at }
          if ('client_msg_temp_id' in data && 'message_id' in data) {
            this.emit('message:ack', data);
            return;
          }
        } catch (err) {
          console.error('[WS] Failed to parse incoming packet:', err, event.data);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[WS] Socket error:', err);
      };

      this.socket.onclose = (event) => {
        this.socket = null;
        this.setStatus('disconnected');

        // Do not reconnect if unauthorized
        if (event.code === 4401 || event.reason?.includes('unauthorized')) {
          console.warn('[WS] Unauthorized connection, not reconnecting.');
          return;
        }

        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[WS] Connection init error:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.token = null;
    this.reconnectAttempts = 0;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  private scheduleReconnect() {
    if (!this.token) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.setStatus('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.emit('status' as any, newStatus);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public sendAction<T>(action: WSActionType, payload: T): boolean {
    const message: WSClientMessage<T> = { action, payload };
    const raw = JSON.stringify(message);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
      return true;
    } else {
      // Queue action if sending message
      if (action === 'message:send') {
        this.pendingQueue.push(raw);
      }
      return false;
    }
  }

  private flushPendingQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.pendingQueue.length > 0) {
      const msg = this.pendingQueue.shift();
      if (msg) this.socket.send(msg);
    }
  }

  /* Specific helper triggers */
  public sendMessage(chatId: string, content: string, tempId: string) {
    return this.sendAction('message:send', {
      client_msg_temp_id: tempId,
      chat_id: chatId,
      content,
    });
  }

  public sendTyping(chatId: string, userId: string, isTyping: boolean) {
    return this.sendAction('typing', {
      user_id: userId,
      chat_id: chatId,
      is_typing: isTyping,
    });
  }

  public sendRead(chatId: string, messageId: number) {
    return this.sendAction('read', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  /* Subscriptions */
  public on<K extends keyof WSEventCallbackMap>(event: K, callback: WSEventCallbackMap[K]) {
    const list = this.listeners.get(event);
    if (list) {
      list.add(callback);
    }
    return () => {
      this.off(event, callback);
    };
  }

  public off<K extends keyof WSEventCallbackMap>(event: K, callback: WSEventCallbackMap[K]) {
    const list = this.listeners.get(event);
    if (list) {
      list.delete(callback);
    }
  }

  private emit(event: WSEventType | 'status', payload: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[WS] Error in handler for event ${event}:`, e);
        }
      });
    }
  }
}

export const wsService = new WebSocketService();
