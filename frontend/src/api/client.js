import axios from 'axios';
import { useAuthStore } from '../stores/authStore';


const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const AUTH_EXCLUDED_PATHS = [
  '/auth/login/',
  '/auth/register/',
  '/auth/refresh/',
  '/auth/logout/'
];
let isRefreshing = false;
let failedQueue = [];

const normalizeError = error => {
  if (error.code === 'ECONNABORTED') {
    return {
      status: 408,
      message: 'Request timeout'
    };
  }

  return {
    status: error.response?.status,
    message:
      error.response?.data?.detail ||
      error.message ||
      'Unknown error'
  };
};
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(normalizeError(error));
    else prom.resolve(token);
  });
  failedQueue = [];
};

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().tokens?.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, error => Promise.reject(normalizeError(error)));

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(normalizeError(error));
    }
    const isExcludedAuthRoute =
      AUTH_EXCLUDED_PATHS.some(path =>
        originalRequest.url?.includes(path)
      );
    if (isExcludedAuthRoute) {
      return Promise.reject(normalizeError(error));
    }
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(normalizeError(err)));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = useAuthStore.getState().tokens?.refresh;
        if (!refreshToken) throw new Error('No refresh token');
        const response = await axios.post(`${API_URL}/auth/refresh/`, { refresh: refreshToken });
        const { access } = response.data;
        useAuthStore.getState().setTokens({ access, refresh: refreshToken });
        processQueue(null, access);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(normalizeError(refreshError));
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(normalizeError(error));
  }
);


export default apiClient;