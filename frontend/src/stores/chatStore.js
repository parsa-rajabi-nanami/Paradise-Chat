import { create } from 'zustand';
import { chatApi } from '../api/chat';
import { wsService } from '../services/websocket';

export const useChatStore = create((set) => ({
  rooms: [],
  activeRoom: null,
  messages: {},
  typingUsers: {},
  onlineUsers: new Set(),
  isLoading: false,

  fetchRooms: async () => {
    set({ isLoading: true });
    try {
      const rooms = await chatApi.getRooms();
      set({ rooms, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  setActiveRoom: (room) => {
    set({ activeRoom: room });
    if (room) {
      chatApi.markAsRead(room.id).catch(() => { });
    }
  },

  createDirectMessage: async (userId) => {
    const room = await chatApi.createDirectMessage(userId);
    set((state) => {
      const exists = state.rooms.some((r) => r.id === room.id);
      return {
        rooms: exists ? state.rooms : [room, ...state.rooms]
      };
    });
    return room;
  },

  createRoom: async (name, participantIds, description) => {
    const room = await chatApi.createRoom({
      room_type: 'group',
      name,
      participant_ids: participantIds,
      description: description || ''
    });
    set((state) => ({
      rooms: [room, ...state.rooms]
    }));
    return room;
  },

  updateRoom: async (roomId, formData) => {
    const updatedRoom = await chatApi.updateRoom(roomId, formData);

    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, ...updatedRoom } : r
      ),
      activeRoom:
        state.activeRoom?.id === roomId
          ? { ...state.activeRoom, ...updatedRoom }
          : state.activeRoom
    }));

    return updatedRoom;
  },

  leaveRoom: async (roomId) => {
    wsService.disconnectFromRoom();

    await chatApi.leaveRoom(roomId);

    set((state) => {
      const remainingMessages = { ...state.messages };
      delete remainingMessages[roomId];

      return {
        rooms: state.rooms.filter((r) => r.id !== roomId),
        activeRoom: state.activeRoom?.id === roomId ? null : state.activeRoom,
        messages: remainingMessages
      };
    });
  },

  updateParticipantRole: async (roomId, userId, role) => {
    try {
      const response = await chatApi.updateParticipantRole(roomId, userId, role);

      set((state) => {
        const updateRoomParticipants = (room) => {
          if (!room || room.id !== roomId) return room;
          return {
            ...room,
            participants_info: room.participants_info.map((p) =>
              p.user.id === userId ? { ...p, role: response.role } : p
            )
          };
        };

        return {
          rooms: state.rooms.map(updateRoomParticipants),
          activeRoom: updateRoomParticipants(state.activeRoom)
        };
      });
    } catch (error) {
      console.error('Failed to update role:', error);
      throw error;
    }
  },

  removeParticipant: async (roomId, userId) => {
    try {
      await chatApi.removeParticipant(roomId, userId);

      set((state) => {
        const filterRoomParticipants = (room) => {
          if (!room || room.id !== roomId) return room;
          return {
            ...room,
            participants_info: room.participants_info.filter(
              (p) => p.user.id !== userId
            )
          };
        };

        return {
          rooms: state.rooms.map(filterRoomParticipants),
          activeRoom: filterRoomParticipants(state.activeRoom)
        };
      });
    } catch (error) {
      console.error('Failed to remove participant:', error);
      throw error;
    }
  },

  addParticipant: async (roomId, user) => {
    try {
      await chatApi.addParticipant(roomId, user.id);

      set((state) => {
        const addToRoom = (room) => {
          if (!room || room.id !== roomId) return room;

          if (room.participants_info.some((p) => p.user.id === user.id)) {
            return room;
          }

          return {
            ...room,
            participants_info: [
              ...room.participants_info,
              { user, role: 'member' }
            ]
          };
        };

        return {
          rooms: state.rooms.map(addToRoom),
          activeRoom: addToRoom(state.activeRoom)
        };
      });
    } catch (error) {
      console.error('Failed to add participant:', error);
      throw error;
    }
  },

  fetchMessages: async (roomId) => {
    try {
      const response = await chatApi.getMessages(roomId);
      const messages = response.results || response;
      set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: Array.isArray(messages) ? [...messages].reverse() : []
        }
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  },

  addMessage: (roomId, message) => {
    set((state) => {
      const roomMessages = state.messages[roomId] || [];
      if (roomMessages.some((m) => m.id === message.id)) {
        return state;
      }

      const updatedLastMessage = {
        id: message.id,
        content: message.content,
        sender: message.sender?.username || message.sender,
        created_at: message.created_at,
        message_type: message.message_type
      };

      const updateRoomMeta = (room) =>
        room.id === roomId ? { ...room, last_message: updatedLastMessage } : room;

      return {
        messages: {
          ...state.messages,
          [roomId]: [...roomMessages, message]
        },
        rooms: state.rooms.map(updateRoomMeta),
        activeRoom: state.activeRoom ? updateRoomMeta(state.activeRoom) : null
      };
    });
  },

  applyMessageUpdate: (roomId, updatedMessage) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: (state.messages[roomId] || []).map((m) =>
          m.id === updatedMessage.id ? updatedMessage : m
        )
      }
    }));
  },

  updateMessage: async (roomId, messageId, newContent) => {
    try {
      const updatedMessage = await chatApi.editMessage(roomId, messageId, newContent);

      set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: (state.messages[roomId] || []).map((m) =>
            m.id === messageId ? updatedMessage : m
          )
        }
      }));
    } catch (error) {
      console.error('Failed to update message:', error);
      throw error;
    }
  },

  applyMessageDelete: (roomId, messageId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: (state.messages[roomId] || []).map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, content: 'This message has been deleted' }
            : m
        )
      }
    }));
  },

  deleteMessage: async (roomId, messageId) => {
    try {
      await chatApi.deleteMessage(roomId, messageId);

      set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: (state.messages[roomId] || []).map((m) =>
            m.id === messageId
              ? { ...m, is_deleted: true, content: 'This message has been deleted' }
              : m
          )
        }
      }));
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  },

  setUserTyping: (roomId, userId, username, isTyping) => {
    set((state) => {
      const now = Date.now();
      const roomTyping = (state.typingUsers[roomId] || []).filter(
        (t) => now - t.timestamp < 10000
      );

      if (isTyping) {
        const existing = roomTyping.find((t) => t.userId === userId);
        const updatedList = existing
          ? roomTyping.map((t) => (t.userId === userId ? { ...t, timestamp: now } : t))
          : [...roomTyping, { userId, username, timestamp: now }];

        return {
          typingUsers: {
            ...state.typingUsers,
            [roomId]: updatedList
          }
        };
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: roomTyping.filter((t) => t.userId !== userId)
        }
      };
    });
  },

  clearTypingUsers: (roomId) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [roomId]: []
      }
    }));
  },

  setUserOnline: (userId, isOnline) => {
    set((state) => {
      const onlineUsers = new Set(state.onlineUsers);
      if (isOnline) {
        onlineUsers.add(userId);
      } else {
        onlineUsers.delete(userId);
      }
      return { onlineUsers };
    });
  },

  setOnlineUsers: (userIds) => {
    set({ onlineUsers: new Set(userIds) });
  }
}));
