import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/auth';

export const useAuthStore = create()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isLoading: false,
      isInitialized: false,
      isAuthenticated: false,

      login: async credentials => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(credentials);
          set({
            user: response.user,
            tokens: response.tokens,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async data => {
        set({ isLoading: true });
        try {
          const response = await authApi.register(data);
          const tokens = response.tokens || (response.access ? { access: response.access, refresh: response.refresh } : null);
          
          set({
            user: response.user || null,
            tokens,
            isAuthenticated: !!tokens?.access,
            isLoading: false
          });
        } catch (error) {
          set({ isLoading: false });
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

      setTokens: newTokens => {
        const currentTokens = get().tokens;
        const updatedTokens = newTokens
          ? { ...currentTokens, ...newTokens }
          : null;

        set({
          tokens: updatedTokens,
          isAuthenticated: !!updatedTokens?.access
        });
      },

      setUser: user => {
        set({ user });
      },

      fetchProfile: async () => {
        try {
          const user = await authApi.getProfile();
          set({ user });
          return user;
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
        set({ isLoading: true });
        try {
          const updatedUser = await authApi.updateProfile(formData);
          set({
            user: updatedUser,
            isLoading: false
          });
          return updatedUser;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      deleteAccount: async (password, passphrase) => {
        const tokens = get().tokens;
        if (!tokens) return;
        
        set({ isLoading: true });
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
          set({ isLoading: false });
          throw error;
        }
      }
    }),
    {
      name: 'auth-storage',

      partialize: state => ({
        tokens: state.tokens,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),

      onRehydrateStorage: () => state => {
        if (state) {
          state.isInitialized = true;
        }
      }
    }
  )
);