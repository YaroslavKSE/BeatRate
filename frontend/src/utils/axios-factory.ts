import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import AuthService from '../api/auth';

// Flag to prevent multiple concurrent refresh token requests
let isRefreshing = false;
// Queue of requests to retry after token refresh
let refreshSubscribers: Array<(token: string) => void> = [];

// Function to add callbacks to the retry queue
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// Function to notify all subscribers about the new token
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

// Function to handle refresh token failures
const onRefreshFailure = (error: any) => {
  console.error('Token refresh failed:', error);
  // Clear subscribers on failure
  refreshSubscribers = [];
  // Clear auth state and redirect to login
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('expiresAt');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

// Environment-specific base URLs
const getBaseUrl = (path: string): string => {
  // Get environment variables with fallbacks
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  // For local development, use complete URLs
  const isLocalDev = import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL;

  if (isLocalDev) {
    // Return the full localhost URL for the specific service
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

  // For dev/staging and production environments
  return `${API_BASE_URL}${path}`;
};

/**
 * Creates a configured Axios instance for a specific API service
 *
 * @param path The API path for this service (e.g., '/users', '/catalog')
 * @param config Additional Axios config options
 * @returns A configured Axios instance
 */
export const createApiClient = (path: string, config?: AxiosRequestConfig): AxiosInstance => {
  const baseURL = getBaseUrl(path);

  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    ...config,
  });

  // Add auth token interceptor
  instance.interceptors.request.use(
    async (config) => {
      // Skip token refresh for auth endpoints that handle refreshing tokens
      const isRefreshRequest =
        config.url?.includes('/refresh-token') ||
        config.url?.includes('/login') ||
        config.url?.includes('/social-login') ||
        config.url?.includes('/register');

      if (!isRefreshRequest && AuthService.isAuthenticated()) {
        // Check if token is expiring soon (5 minutes buffer)
        if (AuthService.isTokenExpiringSoon(300)) {
          try {
            // Only allow one refresh request at a time
            if (!isRefreshing) {
              isRefreshing = true;
              // Refresh the token
              const refreshResponse = await AuthService.refreshToken();
              isRefreshing = false;
              // Notify subscribers about the new token
              onTokenRefreshed(refreshResponse.accessToken);
            }

            // Get the latest token
            const token = AuthService.getToken();
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          } catch (error) {
            isRefreshing = false;
            console.error('Failed to refresh token:', error);
            // Clear auth state on refresh failure
            onRefreshFailure(error);
          }
        } else {
          // Token is still valid, use it
          const token = AuthService.getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response error interceptor
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;

      // Prevent infinite loops
      const isRefreshRequest =
        originalRequest?.url?.includes('/refresh-token') ||
        originalRequest?.url?.includes('/login') ||
        originalRequest?.url?.includes('/social-login') ||
        originalRequest?.url?.includes('/register');

      // Handle 401 errors (unauthorized) that are not on auth endpoints
      if (error.response?.status === 401 && !isRefreshRequest && originalRequest) {
        if (!isRefreshing) {
          isRefreshing = true;

          try {
            // Attempt to refresh the token
            const refreshResponse = await AuthService.refreshToken();
            isRefreshing = false;

            // Update the header of the failed request with the new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${refreshResponse.accessToken}`;
            }

            // Notify subscribers about the new token
            onTokenRefreshed(refreshResponse.accessToken);

            // Retry the original request with the new token
            return axios(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;
            console.error('Failed to refresh token on 401:', refreshError);
            // Clear auth state on refresh failure
            onRefreshFailure(refreshError);
            return Promise.reject(refreshError);
          }
        } else {
          // If a refresh is already in progress, add this request to the retry queue
          return new Promise<AxiosResponse>((resolve) => {
            subscribeTokenRefresh((token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(axios(originalRequest));
            });
          });
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

export default createApiClient;