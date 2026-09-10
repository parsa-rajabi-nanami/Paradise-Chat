import apiClient from './client';

export const authApi = {

  login: async credentials => {
    const response = await apiClient.post('/auth/login/', credentials);
    const data = response.data;

    return {
      user: data.user || null,
      tokens: {
        access: data.access || data.tokens?.access,
        refresh: data.refresh || data.tokens?.refresh
      }
    };
  },

  register: async data => {
    const response = await apiClient.post('/auth/register/', data);
    return response.data;
  },

  logout: async refreshToken => {
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout/', {
          refresh: refreshToken
        });
      }
    } catch {
      // Logout is best effort; the local auth store is cleared by the caller.
      return undefined;
    }
  },

  getProfile: async (config = {}) => {
    const response = await apiClient.get('/auth/profile/', config);
    return response.data;
  },

  updateProfile: async (data, config = {}) => {
    const response = await apiClient.patch('/auth/profile/', data, config);
    return response.data;
  },

  changePassword: async data => {
    const response = await apiClient.post('/auth/password/change/', data);
    return response.data;
  },

  searchUsers: async (query, config = {}) => {
    const response = await apiClient.get('/auth/users/', {
      params: typeof query === 'object' ? query : { search: query },
      ...config
    });
    return response.data.results || response.data;
  },

  getOnlineUsers: async (config = {}) => {
    const response = await apiClient.get('/auth/users/online/', config);
    return response.data.results || response.data;
  },

  deleteAccount: async (data = {}, config = {}) => {
    const response = await apiClient.delete('/auth/profile/delete/', {
      data,
      ...config
    });
    return response.data;
  }

};
