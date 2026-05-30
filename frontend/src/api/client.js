import axios from 'axios';
import { useAuthStore } from '../stores/authStore';


const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
let isRefreshing = false;
let failedQueue = [];


const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};


const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});


// Request interceptor - add auth token
apiClient.interceptors.request.use(config => {

  const token = useAuthStore.getState().tokens?.access;

  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;

}, error => Promise.reject(error));


// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(err));
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
        window.location.href = '/login';

        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);


export default apiClient;