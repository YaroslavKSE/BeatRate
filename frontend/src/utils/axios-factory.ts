import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import AuthService from '../api/auth';

// Global refresh state management
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

// Environment-specific base URLs (keeping your existing logic)
const getBaseUrl = (path: string): string => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const isLocalDev = import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL;

  if (isLocalDev) {
    const servicePorts: Record<string, string> = {
      '/auth': 'http://localhost:5001/api/v1/auth',
      '/users': 'http://localhost:5001/api/v1/users',
      '/public/users': 'http://localhost:5001/api/v1/public/users',
      '/users/subscriptions': 'http://localhost:5001/api/v1/users/subscriptions',
      '/users/avatars': 'http://localhost:5001/api/v1/users/avatars',
      '/catalog': 'http://localhost:5002/api/v1/catalog',
      '/interactions': 'http://localhost:5003/api/v1/interactions',
      '/review-interactions': 'http://localhost:5003/api/v1/review-interactions',
      '/grading-methods': 'http://localhost:5003/api/v1/grading-methods',
      '/users/preferences': 'http://localhost:5001/api/v1/users/preferences',
      '/music-lists': 'http://localhost:5004/api/v1/music-lists',
    };
    return servicePorts[path] || `http://localhost:5000${path}`;
  }

  return `${API_BASE_URL}${path}`;
};

// Centralized token refresh function
const refreshToken = async (): Promise<string> => {
  if (isRefreshing && refreshPromise) {
    console.log('[TOKEN] Waiting for existing refresh...');
    return refreshPromise;
  }

  console.log('[TOKEN] Starting token refresh...');
  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      // Check if we have a refresh token before attempting refresh
      const currentRefreshToken = localStorage.getItem('refreshToken');
      if (!currentRefreshToken || currentRefreshToken === 'null') {
        throw new Error('No valid refresh token available');
      }

      const response = await AuthService.refreshToken();
      console.log('[TOKEN] Refresh successful');
      return response.accessToken;
    } catch (error) {
      console.error('[TOKEN] Refresh failed:', error);
      // Clear auth state on refresh failure
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('expiresAt');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Check if we should refresh the token
const shouldRefreshToken = (): boolean => {
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  const expiresAtStr = localStorage.getItem('expiresAt');

  // Check if we have valid tokens
  if (!token || token === 'null' || !refreshToken || refreshToken === 'null') {
    console.log('[TOKEN] Missing or invalid tokens');
    return false;
  }

  if (!expiresAtStr || expiresAtStr === 'null') {
    console.log('[TOKEN] No expiration time found');
    return false;
  }

  const expiresAt = parseInt(expiresAtStr, 10);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  const shouldRefresh = now + fiveMinutes >= expiresAt;

  if (shouldRefresh) {
    console.log('[TOKEN] Token expires in:', Math.floor((expiresAt - now) / 1000), 'seconds');
  }

  return shouldRefresh;
};

// Helper to get current token or refresh if needed
const getValidToken = async (): Promise<string | null> => {
  if (!AuthService.isAuthenticated()) {
    return null;
  }

  if (shouldRefreshToken()) {
    try {
      return await refreshToken();
    } catch (error) {
      console.error('[TOKEN] Failed to refresh token:', error);
      return null;
    }
  }

  return AuthService.getToken();
};

export const createApiClient = (path: string, config?: AxiosRequestConfig): AxiosInstance => {
  const baseURL = getBaseUrl(path);

  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    ...config,
  });

  // Request interceptor - add auth token
  instance.interceptors.request.use(
    async (config) => {
      // Skip auth for auth endpoints
      const isAuthEndpoint =
        config.url?.includes('/refresh-token') ||
        config.url?.includes('/login') ||
        config.url?.includes('/social-login') ||
        config.url?.includes('/register');

      if (!isAuthEndpoint) {
        try {
          const token = await getValidToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('[TOKEN] Failed to get valid token for request:', error);
        }
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle 401 errors
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      // Handle 401 errors on non-auth endpoints
      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/refresh-token') &&
        !originalRequest.url?.includes('/login') &&
        !originalRequest.url?.includes('/register')
      ) {
        console.log('[TOKEN] 401 error, attempting token refresh...');
        originalRequest._retry = true;

        try {
          const newToken = await refreshToken();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          console.log('[TOKEN] Retrying request with new token');
          return axios(originalRequest);
        } catch (refreshError) {
          console.error('[TOKEN] Refresh failed on 401, redirecting to login');
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

export default createApiClient;