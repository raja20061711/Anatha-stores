import axios from 'axios';

// Centralized API Base URL configuration
const rawBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000/api';
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const BACKEND_ROOT_URL = API_BASE_URL.replace(/\/api$/, '');

/**
 * Helper to build full backend API URLs
 * @param {string} endpoint - Path relative to API base (e.g. '/products')
 * @returns {string} Fully qualified URL
 */
export const getApiUrl = (endpoint = '') => {
  if (!endpoint) return API_BASE_URL;
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanPath}`;
};

/**
 * Helper to build full backend Product Image URLs
 * @param {string} url - Image URL or relative path
 * @returns {string} Fully qualified URL or data URL
 */
export const getProductImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_ROOT_URL}${cleanPath}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('anatha_pos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('anatha_pos_token');
      localStorage.removeItem('anatha_pos_user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Health check helper for backend connectivity
 * Checks GET /health (relative to baseURL = /api/health)
 */
export const checkBackendHealth = async () => {
  const startTime = Date.now();
  try {
    const res = await api.get('/health', { timeout: 4000 });
    const isHealthy = res.status === 200 && (res.data?.status === 'HEALTHY' || res.data?.status === 'OK' || res.data?.server === 'ONLINE');
    return {
      ok: isHealthy,
      status: res.status,
      data: res.data,
      latencyMs: Date.now() - startTime,
      targetUrl: `${API_BASE_URL}/health`,
    };
  } catch (err) {
    const isNetworkError = err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !err.response;
    return {
      ok: false,
      isNetworkError,
      status: err.response?.status || 0,
      targetUrl: `${API_BASE_URL}/health`,
      error: isNetworkError
        ? `Cannot connect to POS Backend Server (${BACKEND_ROOT_URL}). Please verify the backend is running.`
        : (err.response?.data?.error || err.message || 'Backend server returned error'),
      details: err.message,
    };
  }
};

export default api;
