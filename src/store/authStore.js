import { create } from 'zustand';
import api, { BACKEND_ROOT_URL, checkBackendHealth } from '../services/api';

const savedToken = localStorage.getItem('anatha_pos_token');
let savedUser = null;
try {
  const rawUser = localStorage.getItem('anatha_pos_user');
  if (rawUser) savedUser = JSON.parse(rawUser);
} catch (e) {
  savedUser = null;
}

export const useAuthStore = create((set, get) => ({
  user: savedUser,
  token: savedToken,
  isAuthenticated: !!savedToken && !!savedUser,
  isLoading: false,
  error: null,
  serverOnline: null,
  serverDetails: null,

  checkServer: async () => {
    try {
      const health = await checkBackendHealth();
      set({ 
        serverOnline: health.ok,
        serverDetails: health.ok ? health.data : null 
      });
      if (health.ok) {
        const currentErr = get().error;
        if (currentErr && (currentErr.includes('Cannot connect') || currentErr.includes('Network Error'))) {
          set({ error: null });
        }
      }
      return health.ok;
    } catch (e) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        console.warn('[POS Dev] Backend health check failed:', e?.message || e);
      }
      set({ serverOnline: false, serverDetails: null });
      return false;
    }
  },

  setError: (err) => set({ error: err }),

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
        serverOnline: true,
      });

      return { success: true, user };
    } catch (err) {
      let isNetworkErr = false;
      let msg = err.response?.data?.error;
      if (!msg) {
        if (err.message === 'Network Error' || err.code === 'ERR_NETWORK' || !err.response) {
          isNetworkErr = true;
          msg = `Network Error: Cannot connect to POS Backend Server (${BACKEND_ROOT_URL}). Please check that the server is running.`;
        } else {
          msg = err.message || 'Login failed. Please check credentials.';
        }
      }
      set({
        isLoading: false,
        error: msg,
        serverOnline: isNetworkErr ? false : null,
      });
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
