import { create } from 'zustand';
import api from '../services/api';

const savedToken = localStorage.getItem('anatha_pos_token');
let savedUser = null;
try {
  const rawUser = localStorage.getItem('anatha_pos_user');
  if (rawUser) savedUser = JSON.parse(rawUser);
} catch (e) {
  savedUser = null;
}

export const useAuthStore = create((set) => ({
  user: savedUser,
  token: savedToken,
  isAuthenticated: !!savedToken && !!savedUser,
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { username, password });
      const { user, token } = res.data;

      localStorage.setItem('anatha_pos_token', token);
      localStorage.setItem('anatha_pos_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true, user };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed. Please check credentials.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout').catch(() => {});
    } finally {
      localStorage.removeItem('anatha_pos_token');
      localStorage.removeItem('anatha_pos_user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('anatha_pos_token');
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false });
      return;
    }

    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.user, isAuthenticated: true });
    } catch (err) {
      localStorage.removeItem('anatha_pos_token');
      localStorage.removeItem('anatha_pos_user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),
}));
