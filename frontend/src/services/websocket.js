import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { chatApi } from '../api/chat';
import { refreshAccessToken } from '../api/client';

class WebSocketService {
  socket = null;
  statusSocket = null;
  roomId = null;

  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  reconnectTimeout = null;

  statusReconnectAttempts = 0;
  statusReconnectTimeout = null;
  roomConnectionVersion = 0;
  statusConnectionVersion = 0;

  heartbeatInterval = null;
  messageHandlers = [];
  getWsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const configuredHost = (import.meta.env.VITE_WS_HOST || '')
      .trim()
      .replace(/^wss?:\/\//, '')
      .replace(/\/$/, '');
    const currentHost = window.location.host;
    const isLoopbackHost = host =>
      /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(host);
    const host =
      configuredHost &&
      !(isLoopbackHost(configuredHost) && !isLoopbackHost(currentHost))
        ? configuredHost
        : currentHost;
    return `${protocol}//${host}`;
  }

  async connectToRoom(roomId, isReconnecting = false) {
    if (
      (this.socket?.readyState === WebSocket.OPEN ||
        this.socket?.readyState === WebSocket.CONNECTING) &&
      this.roomId === roomId
    ) {
      return;
    }

    this.disconnectFromRoom(!isReconnecting);
    this.roomId = roomId;
    useChatStore.getState().setSocketStatus('connecting');
    const connectionVersion = this.roomConnectionVersion;

    const token = await this.getAccessToken();
    if (!token) {
      return;
    }

    if (
      this.roomId !== roomId ||
      this.roomConnectionVersion !== connectionVersion
    ) {
      return;
    }

    const url = `${this.getWsUrl()}/ws/chat/${roomId}/?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      console.log(`Connected to room ${roomId}`);
      useChatStore.getState().setSocketStatus('connected');
      this.reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      console.log(`Disconnected from room ${roomId}`, event.code);
      useChatStore.getState().setSocketStatus('disconnected');
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      useChatStore.getState().setSocketStatus('error');
    };
  }

  disconnectFromRoom(resetReconnectCount = true) {
    this.roomConnectionVersion += 1;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }

    this.roomId = null;
    if (resetReconnectCount) {
      this.reconnectAttempts = 0;
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const currentRoomId = this.roomId;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      if (currentRoomId) {
        this.connectToRoom(currentRoomId, true);
      }
    }, delay);
  }

  async connectToStatus() {
    if (
      this.statusSocket?.readyState === WebSocket.OPEN ||
      this.statusSocket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const connectionVersion = this.statusConnectionVersion;
    const token = await this.getAccessToken();
    if (!token) return;

    if (this.statusConnectionVersion !== connectionVersion) return;

    const url = `${this.getWsUrl()}/ws/status/?token=${encodeURIComponent(token)}`;

    const socket = new WebSocket(url);
    this.statusSocket = socket;

    socket.onopen = () => {
      console.log('Connected to status updates');
      this.statusReconnectAttempts = 0;
      this.startHeartbeat();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          useChatStore.getState().setUserOnline(data.user_id, data.is_online);
        }
      } catch (error) {
        console.error('Failed to parse status message:', error);
      }
    };

    socket.onclose = (event) => {
      if (this.statusSocket !== socket) return;
      console.log('Disconnected from status updates');
      this.stopHeartbeat();

      if (!event.wasClean && this.statusReconnectAttempts < this.maxReconnectAttempts) {
        this.statusReconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.statusReconnectAttempts), 30000);
        this.statusReconnectTimeout = setTimeout(() => this.connectToStatus(), delay);
      }
    };

    socket.onerror = () => {
      // onclose performs the reconnect; avoid noisy unhandled browser errors.
    };
  }

  disconnectFromStatus() {
    this.statusConnectionVersion += 1;
    this.stopHeartbeat();

    if (this.statusReconnectTimeout) {
      clearTimeout(this.statusReconnectTimeout);
      this.statusReconnectTimeout = null;
    }

    if (this.statusSocket) {
      this.statusSocket.onclose = null;
      this.statusSocket.close();
      this.statusSocket = null;
    }

    this.statusReconnectAttempts = 0;
  }

  async getAccessToken() {
    const access = useAuthStore.getState().tokens?.access;
    if (!access || !this.isTokenExpiring(access)) return access;

    try {
      return await refreshAccessToken();
    } catch {
      return null;
    }
  }

  isTokenExpiring(token) {
    try {
      const [, encodedPayload] = token.split('.');
      if (!encodedPayload) return false;

      const base64Payload = encodedPayload
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const paddedPayload = base64Payload.padEnd(
        base64Payload.length + ((4 - (base64Payload.length % 4)) % 4),
        '='
      );
      const payload = JSON.parse(
        atob(paddedPayload)
      );
      return Number(payload.exp) <= Math.floor(Date.now() / 1000) + 30;
    } catch {
      return true;
    }
  }

  disconnectAll() {
    this.disconnectFromRoom();
    this.disconnectFromStatus();
  }

  startHeartbeat() {
    this.stopHeartbeat();

    if (!this.statusSocket || this.statusSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.statusSocket?.readyState === WebSocket.OPEN) {
        this.statusSocket.send(JSON.stringify({ type: 'heartbeat' }));
      } else {
        this.stopHeartbeat();
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleMessage(data) {
    const chatStore = useChatStore.getState();

    switch (data.type) {
      case 'message':
        if (data.message && this.roomId) {
          chatStore.addMessage(this.roomId, data.message);
        }
        break;
      case 'typing':
        if (this.roomId && data.user_id && data.username) {
          chatStore.setUserTyping(
            this.roomId,
            data.user_id,
            data.username,
            data.is_typing || false
          );
        }
        break;
      case 'edit':
        if (data.message && this.roomId) {
          chatStore.applyMessageUpdate(this.roomId, data.message);
        }
        break;
      case 'delete':
        if (data.message_id && this.roomId) {
          chatStore.applyMessageDelete(this.roomId, data.message_id);
        }
        break;
      case 'user_join':
      case 'user_leave':
      case 'read':
        break;
      default:
        break;
    }

    this.messageHandlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    });
  }

  sendSocketMessage(payload, roomId = this.roomId) {
    const socket = this.socket;
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      this.roomId !== roomId
    ) {
      return false;
    }

    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch {
      // A socket can close between readyState and send. Callers that have a
      // REST fallback continue through that path instead of surfacing a
      // native "closed WebSocket" error to the console.
      return false;
    }
  }

  async sendMessage({ room = null, content = '', file = null, replyTo = null }) {
    const targetRoomId = room || this.roomId;

    if (!targetRoomId) {
      throw new Error('Cannot send message: No active room specified.');
    }

    if (file) {
      const created = await chatApi.sendAttachment(targetRoomId, content, file, replyTo);
      useChatStore.getState().addMessage(targetRoomId, created);
      return created;
    }

    if (
      this.sendSocketMessage(
        {
          type: 'message',
          content,
          reply_to: replyTo
        },
        targetRoomId
      )
    ) {
        return true;
    }

    const created = await chatApi.sendMessage(targetRoomId, content, replyTo);
    useChatStore.getState().addMessage(targetRoomId, created);
    return created;
  }

  sendTyping(isTyping, roomId = this.roomId) {
    this.sendSocketMessage(
      {
        type: 'typing',
        is_typing: isTyping
      },
      roomId
    );
  }

  sendRead() {
    this.sendSocketMessage({ type: 'read' });
  }

  editMessage(messageId, content) {
    this.sendSocketMessage({
      type: 'edit',
      message_id: messageId,
      content
    });
  }

  deleteMessage(messageId) {
    this.sendSocketMessage({
      type: 'delete',
      message_id: messageId
    });
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
