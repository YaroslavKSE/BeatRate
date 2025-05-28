import { create } from 'zustand';
import axios from 'axios';
import AuthService, { UserProfile, UpdateProfileParams } from '../api/auth';
import { handleAuth0Logout } from '../utils/auth0-config';
import UsersService from "../api/users.ts";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authInitialized: boolean; // State to track if auth has been initialized
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  socialLogin: (code: string, redirectUri: string, provider: string) => Promise<void>;
  register: (email: string, password: string, name: string, surname: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>; // New action to refresh the token
  clearError: () => void;
  setUser: (user: UserProfile | null) => void;
  fetchUserProfile: () => Promise<void>;
  updateProfile: (params: UpdateProfileParams) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  deleteBio: () => Promise<void>;
  initializeAuth: () => Promise<void>; // Action to initialize auth state
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      console.error('Error parsing stored user:', e);
      return null;
    }
  })(),
  isAuthenticated: AuthService.isAuthenticated(),
  isLoading: true,
  authInitialized: false,
  error: null,

  // Initialize authentication state
  initializeAuth: async () => {
    try {
      set({ isLoading: true });
      const hasToken = AuthService.isAuthenticated();

      if (hasToken) {
        try {
          // If token is expiring soon, refresh it
          if (AuthService.isTokenExpiringSoon()) {
            try {
              await get().refreshToken();
            } catch (refreshError) {
              console.error('Token refresh error during init:', refreshError);
              // If refresh fails during init, clear auth state
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('expiresAt');
              localStorage.removeItem('user');
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                authInitialized: true
              });
              return;
            }
          }

          // Try to get user from localStorage first
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            set({
              user: parsedUser,
              isAuthenticated: true,
              isLoading: false,
              authInitialized: true
            });

            // Optionally fetch fresh data in background
            get().fetchUserProfile().catch(err => {
              console.error('Background refresh error:', err);
            });
          } else {
            // If no stored user, fetch it
            await get().fetchUserProfile();
            set({ authInitialized: true });
          }
        } catch (error) {
          // If getting the user profile fails, we invalidate the auth
          console.error('Error getting user profile during init:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('expiresAt');
          localStorage.removeItem('user');
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            authInitialized: true
          });
        }
      } else {
        set({
          isAuthenticated: false,
          isLoading: false,
          authInitialized: true
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({
        isAuthenticated: false,
        isLoading: false,
        authInitialized: true,
        error: 'Failed to initialize authentication'
      });
    }
  },

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      await AuthService.login({ email, password });
      await get().fetchUserProfile();
      set({ isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Login error:', error);

      let errorMessage = 'Failed to login. Please try again.';

      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData && typeof responseData === 'object' && 'message' in responseData) {
          errorMessage = String(responseData.message);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        isLoading: false,
        error: errorMessage
      });
      throw error;
    }
  },

  socialLogin: async (code: string, redirectUri: string, provider: string) => {
    try {
      set({ isLoading: true, error: null });

      await AuthService.socialLogin({ code, redirectUri, provider });
      await get().fetchUserProfile();

      set({ isAuthenticated: true, isLoading: false });

    } catch (error) {
      console.error('Social login error:', error);

      let errorMessage = `Failed to login with ${provider}. Please try again.`;

      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData && typeof responseData === 'object' && 'message' in responseData) {
          errorMessage = String(responseData.message);
        }

        // Log more details for debugging
        console.error('Social login axios error details:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        });
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        isLoading: false,
        error: errorMessage
      });
      throw error;
    }
  },

  // New method to refresh the token
  refreshToken: async () => {
    try {
      await AuthService.refreshToken();
      set({ isAuthenticated: true });
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);

      // If refresh fails, clear auth state
      set({
        user: null,
        isAuthenticated: false,
        error: 'Session expired. Please login again.'
      });

      // Clean up storage
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('expiresAt');
      localStorage.removeItem('user');

      return false;
    }
  },

  register: async (email: string, password: string, name: string, surname: string, username: string) => {
    try {
      set({ isLoading: true, error: null });
      await AuthService.register({ email, password, name, surname, username});
      set({ isLoading: false });
    } catch (error) {
      console.error('Registration error:', error);

      let errorMessage = 'Failed to register. Please try again.';

      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData && typeof responseData === 'object' && 'message' in responseData) {
          errorMessage = String(responseData.message);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        isLoading: false,
        error: errorMessage
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });

      // First, call our backend logout API to revoke the refresh token
      await AuthService.logout();

      // Then, log out from Auth0 directly
      await handleAuth0Logout();

      // Clear local state
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, we should reset the auth state
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  updateProfile: async (params: UpdateProfileParams) => {
    try {
      set({ isLoading: true, error: null });
      const updatedUser = await AuthService.updateProfile(params);
      set({
        user: updatedUser,
        isLoading: false
      });
    } catch (error) {
      console.error('Profile update error:', error);

      // Handle different error types
      let errorMessage = 'Failed to update profile. Please try again.';

      if (axios.isAxiosError(error)) {
        // Type-safe access to Axios error properties
        const responseData = error.response?.data;

        if (responseData && typeof responseData === 'object') {
          if ('message' in responseData) {
            errorMessage = String(responseData.message);
          } else if ('code' in responseData && responseData.code === 'UsernameAlreadyTaken') {
            errorMessage = 'This username is already taken. Please choose another one.';
          }
        }
      } else if (error instanceof Error) {
        // Fallback to standard Error object
        errorMessage = error.message;
      }

      set({
        isLoading: false,
        error: errorMessage
      });

      throw error;
    }
  },

  // Add function to update bio
  updateBio: async (bio: string) => {
    try {
      set({ isLoading: true, error: null });
      const updatedUser = await AuthService.updateBio(bio);
      set({
        user: updatedUser,
        isLoading: false
      });
    } catch (error) {
      console.error('Bio update error:', error);

      let errorMessage = 'Failed to update bio. Please try again.';

      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData && typeof responseData === 'object' && 'message' in responseData) {
          errorMessage = String(responseData.message);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        isLoading: false,
        error: errorMessage
      });

      throw error;
    }
  },

  // Add function to delete bio
  deleteBio: async () => {
    try {
      set({ isLoading: true, error: null });
      const updatedUser = await AuthService.deleteBio();
      set({
        user: updatedUser,
        isLoading: false
      });
    } catch (error) {
      console.error('Bio delete error:', error);

      let errorMessage = 'Failed to delete bio. Please try again.';

      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData && typeof responseData === 'object' && 'message' in responseData) {
          errorMessage = String(responseData.message);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        isLoading: false,
        error: errorMessage
      });

      throw error;
    }
  },

  clearError: () => set({ error: null }),

  // Fixed setUser method - this replaces the need for updateUser
  setUser: (user) => set({ user }),

  fetchUserProfile: async () => {
  if (!AuthService.isAuthenticated()) {
    set({ isLoading: false, isAuthenticated: false });
    return;
  }

  try {
    set({ isLoading: true });

    // Step 1: Fetch basic user profile from AuthService
    const userProfile = await AuthService.getCurrentUser();

    // Step 2: Enhance with follower/following counts
    try {
      // Get followers - we only need the count, not the actual followers
      const followersResponse = await UsersService.getUserFollowers(1, 1);

      // Get following count - again, just need the count
      const followingResponse = await UsersService.getUserFollowing(1, 1);

      // Enhance the user profile with the counts
      const enhancedProfile = {
        ...userProfile,
        followerCount: followersResponse.totalCount || 0,
        followingCount: followingResponse.totalCount || 0
      };

      // Save the enhanced profile to localStorage
      localStorage.setItem('user', JSON.stringify(enhancedProfile));

      // Update the state with the enhanced profile
      set({
        user: enhancedProfile,
        isLoading: false,
        isAuthenticated: true
      });

    } catch (countError) {
      console.error('Error fetching follower/following counts:', countError);

      // If we fail to get the counts, just use the basic profile
      localStorage.setItem('user', JSON.stringify(userProfile));

      set({
        user: userProfile,
        isLoading: false,
        isAuthenticated: true
      });
    }

  } catch (error) {
    // Handle error when the basic profile fetch fails
    console.error('Error fetching user profile:', error);

    let errorMessage = 'Failed to fetch user profile.';

    if (!axios.isAxiosError(error)) {
      if (error instanceof Error) {
        errorMessage = error.message;
      }
    } else {
      const responseData = error.response?.data;
      if (responseData && typeof responseData === 'object' && 'message' in responseData) {
        errorMessage = String(responseData.message);
      }
    }

    // Clear authentication state on failure
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('expiresAt');
    localStorage.removeItem('user');

    set({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      error: errorMessage
    });
  }
}
}));

export default useAuthStore;