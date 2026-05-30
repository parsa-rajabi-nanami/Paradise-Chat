import apiClient from './client';


export const chatApi = {

  getRooms: async () => {
    const response = await apiClient.get('/chat/rooms/');
    return response.data.results || response.data;
  },

  getRoom: async roomId => {
    const response = await apiClient.get(`/chat/rooms/${roomId}/`);
    return response.data;
  },

  createRoom: async data => {
    const response = await apiClient.post('/chat/rooms/', data);
    return response.data;
  },

  leaveRoom: async roomId => {
    await apiClient.delete(`/chat/rooms/${roomId}/`);
  },

  updateParticipantRole: async (roomId, userId, role) => {
    const response = await apiClient.patch(`/chat/rooms/${roomId}/participants/${userId}/`, {
      role
    });
    return response.data;
  },

  removeParticipant: async (roomId, userId) => {
    await apiClient.delete(`/chat/rooms/${roomId}/participants/${userId}/`);
  },

  addParticipant: async (roomId, userId) => {
    const response = await apiClient.post(
      `/chat/rooms/${roomId}/participants/${userId}/`
    );
    return response.data;
  },

  createDirectMessage: async userId => {
    const response = await apiClient.post('/chat/direct/', {
      room_type: "direct",
      participant_ids: [userId],
      user_id: userId
    });
    return response.data;
  },

  getMessages: async (roomId, page = 1) => {
    const response = await apiClient.get(`/chat/rooms/${roomId}/messages/?page=${page}`);
    return response.data;
  },

  sendMessage: async (roomId, content, replyTo) => {
    const response = await apiClient.post(`/chat/rooms/${roomId}/messages/`, {
      content,
      reply_to: replyTo
    });
    return response.data;
  },

  editMessage: async (roomId, messageId, content) => {
    const response = await apiClient.patch(`/chat/rooms/${roomId}/messages/${messageId}/`, {
      content
    });
    return response.data;
  },

  deleteMessage: async (roomId, messageId) => {
    await apiClient.delete(`/chat/rooms/${roomId}/messages/${messageId}/`);
  },

  markAsRead: async roomId => {
    await apiClient.post(`/chat/rooms/${roomId}/read/`);
  },

  updateTypingStatus: async (roomId, isTyping) => {
    await apiClient.post(`/chat/rooms/${roomId}/typing/`, {
      is_typing: isTyping
    });
  },

  updateRoom: async (roomId, formData) => {
    const response = await apiClient.patch(
      `/chat/rooms/${roomId}/`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      }
    );
    return response.data;
  },

};