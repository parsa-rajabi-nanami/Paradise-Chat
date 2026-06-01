import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/auth';


export const useAuthStore = create()(persist((set, get) => ({
  user: null,
  tokens: null,
  isLoading: false,
  isAuthenticated: false,

  login: async credentials => {
    set({
      isLoading: true
    });
    try {
      const response = await authApi.login(credentials);
      set({
        user: response.user,
        tokens: response.tokens,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      set({
        isLoading: false
      });
      throw error;
    }
  },

  register: async data => {
    set({
      isLoading: true
    });
    try {
      const response = await authApi.register(data);
      set({
        user: response.user,
        tokens: response.tokens,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      set({
        isLoading: false
      });
      throw error;
    }
  },

  logout: async () => {
    const tokens = get().tokens;
    try {
      if (tokens?.refresh) {
        await authApi.logout(tokens.refresh);
      }
    } finally {
      set({
        user: null,
        tokens: null,
        isAuthenticated: false
      });
    }
  },

  setTokens: tokens => {
    set({
      tokens,
      isAuthenticated: !!tokens?.access
    });
  },

  setUser: user => {
    set({
      user
    });
  },

  fetchProfile: async () => {
    try {
      const user = await authApi.getProfile();
      set({
        user
      });
    } catch (error) {
      if (error.status === 401) {
        set({
          user: null,
          tokens: null,
          isAuthenticated: false
        });
      }

      throw error;
    }
  },

  updateProfile: async formData => {
    const {
      fetchProfile
    } = get();
    try {
      await authApi.updateProfile(formData);
      await fetchProfile();
    } catch (error) {
      throw error;
    }
  },

  deleteAccount: async (password, passphrase) => {
    const tokens = get().tokens;
    if (!tokens) return;
    set({
      isLoading: true
    });
    try {
      await authApi.deleteAccount({
        password,
        passphrase,
        refresh: tokens.refresh
      });
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false
      });
    } catch (error) {
      set({
        isLoading: false
      });
      throw error;
    }
  }

}), {
  name: 'auth-storage',

  partialize: state => ({
    tokens: state.tokens,
    user: state.user,
    isAuthenticated: state.isAuthenticated
  })
}));