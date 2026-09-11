import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { chatApi } from '../api/chat';

class WebSocketService {
  socket = null;
  statusSocket = null;
  roomId = null;

  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  reconnectTimeout = null;

  statusReconnectAttempts = 0;
  statusReconnectTimeout = null;

  heartbeatInterval = null;
  messageHandlers = [];
  getWsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || window.location.host;
    return `${protocol}//${host}`;
  }

  connectToRoom(roomId, isReconnecting = false) {
    if (this.socket?.readyState === WebSocket.OPEN && this.roomId === roomId) {
      return;
    }

    this.disconnectFromRoom(!isReconnecting);
    this.roomId = roomId;

    const token = useAuthStore.getState().tokens?.access;
    if (!token) {
      console.error('No auth token available');
      return;
    }

    const url = `${this.getWsUrl()}/ws/chat/${roomId}/?token=${encodeURIComponent(token)}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log(`Connected to room ${roomId}`);
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`Disconnected from room ${roomId}`, event.code);
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnectFromRoom(resetReconnectCount = true) {
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

  connectToStatus() {
    if (this.statusSocket?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = useAuthStore.getState().tokens?.access;
    if (!token) return;

    const url = `${this.getWsUrl()}/ws/status/?token=${encodeURIComponent(token)}`;

    this.statusSocket = new WebSocket(url);

    this.statusSocket.onopen = () => {
      console.log('Connected to status updates');
      this.statusReconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.statusSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          useChatStore.getState().setUserOnline(data.user_id, data.is_online);
        }
      } catch (error) {
        console.error('Failed to parse status message:', error);
      }
    };

    this.statusSocket.onclose = (event) => {
      console.log('Disconnected from status updates');
      this.stopHeartbeat();

      if (!event.wasClean && this.statusReconnectAttempts < this.maxReconnectAttempts) {
        this.statusReconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.statusReconnectAttempts), 30000);
        this.statusReconnectTimeout = setTimeout(() => this.connectToStatus(), delay);
      }
    };

    this.statusSocket.onerror = () => {
      // onclose performs the reconnect; avoid noisy unhandled browser errors.
    };
  }

  disconnectFromStatus() {
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

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'message',
          content,
          reply_to: replyTo
        })
      );
      return true;
    }

    throw new Error('WebSocket is not connected');
  }

  sendTyping(isTyping) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'typing',
          is_typing: isTyping
        })
      );
    }
  }

  sendRead() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'read'
        })
      );
    }
  }

  editMessage(messageId, content) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'edit',
          message_id: messageId,
          content
        })
      );
    }
  }

  deleteMessage(messageId) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'delete',
          message_id: messageId
        })
      );
    }
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
