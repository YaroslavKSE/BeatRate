import { useEffect, useRef } from 'react';
import useAuthStore from '../../store/authStore';

// Time in milliseconds before token expiry when we should refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Component that manages token refreshing in the background
 * This should be included in the App layout
 */
const TokenRefreshManager: React.FC = () => {
  const { refreshToken, isAuthenticated } = useAuthStore();
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clean up any existing timer
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Only set up refresh timer if authenticated
    if (isAuthenticated) {
      const setupRefreshTimer = () => {
        // Get token expiration time
        const expiresAtStr = localStorage.getItem('expiresAt');
        if (!expiresAtStr) return;

        const expiresAt = parseInt(expiresAtStr, 10);
        const now = Date.now();

        // Calculate time until refresh (subtracting buffer)
        const timeUntilRefresh = Math.max(0, expiresAt - now - REFRESH_BUFFER_MS);

        console.log(`Token expires in ${(expiresAt - now) / 1000} seconds, scheduling refresh in ${timeUntilRefresh / 1000} seconds`);

        // Set timer to refresh before token expires
        refreshTimerRef.current = window.setTimeout(async () => {
          console.log('Refreshing token in background...');
          try {
            const success = await refreshToken();

            if (success) {
              // If refresh successful, set up the next refresh
              setupRefreshTimer();
            }
          } catch (error) {
            console.error('Background token refresh failed:', error);
          }
        }, timeUntilRefresh);
      };

      // Initial setup of the refresh timer
      setupRefreshTimer();
    }

    // Clean up timer on unmount or when auth state changes
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isAuthenticated, refreshToken]);

  // This component doesn't render anything
  return null;
};

export default TokenRefreshManager;