import apiClient from './client';


export const authApi = {

  login: async credentials => {
    const response = await apiClient.post('/auth/login/', credentials);
    return {
      user: response.data.user,
      tokens: {
        access: response.data.access,
        refresh: response.data.refresh
      }
    };
  },

  register: async data => {
    const response = await apiClient.post('/auth/register/', data);
    return response.data;
  },

  logout: async refreshToken => {
    await apiClient.post('/auth/logout/', {
      refresh: refreshToken
    });
  },

  getProfile: async () => {
    const response = await apiClient.get('/auth/profile/');
    return response.data;
  },

  updateProfile: async formData => {
    const response = await apiClient.patch('/auth/profile/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  changePassword: async data => {
    await apiClient.post('/auth/password/change/', data);
  },

  searchUsers: async query => {
    const response = await apiClient.get(`/auth/users/?search=${query}`);
    return response.data;
  },

  getOnlineUsers: async () => {
    const response = await apiClient.get('/auth/users/online/');
    return response.data;
  },

  deleteAccount: async data => {
    await apiClient.delete('/auth/profile/delete/', {
      data: data
    });
  }

};