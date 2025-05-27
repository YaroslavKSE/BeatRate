import React, { useEffect, useRef } from 'react';
import useAuthStore from '../../store/authStore';

// Time in milliseconds before token expiry when we should refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
// Check interval - every 1 minute
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Token Refresh Manager
 * Uses interval-based checking instead of complex timers
 */
const TokenRefreshManager: React.FC = () => {
  const { refreshToken, isAuthenticated, authInitialized } = useAuthStore();
  const intervalRef = useRef<number | null>(null);
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    // Only start checking if authenticated and auth is initialized
    if (!isAuthenticated || !authInitialized) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkAndRefresh = async () => {
      try {
        const expiresAtStr = localStorage.getItem('expiresAt');
        if (!expiresAtStr) {
          console.log('[TOKEN-MANAGER] No expiration time found');
          return;
        }

        const expiresAt = parseInt(expiresAtStr, 10);
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        const shouldRefresh = timeUntilExpiry <= REFRESH_BUFFER_MS;

        // Prevent multiple refreshes within 30 seconds
        const timeSinceLastRefresh = now - lastRefreshRef.current;

        // console.log('[TOKEN-MANAGER] Check:', {
        //   timeUntilExpiry: Math.floor(timeUntilExpiry / 1000),
        //   shouldRefresh,
        //   timeSinceLastRefresh: Math.floor(timeSinceLastRefresh / 1000)
        // });

        if (shouldRefresh && timeSinceLastRefresh > 30000) {
          lastRefreshRef.current = now;

          const success = await refreshToken();
          if (success) {
            console.log('[TOKEN-MANAGER] Token refresh successful');
          } else {
            console.error('[TOKEN-MANAGER] Token refresh failed');
          }
        }
      } catch (error) {
        console.error('[TOKEN-MANAGER] Error during token check:', error);
      }
    };

    // Initial check
    checkAndRefresh();

    // Set up interval checking
    intervalRef.current = window.setInterval(checkAndRefresh, CHECK_INTERVAL_MS);

    // Cleanup on unmount or auth state change
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, authInitialized, refreshToken]);

  return null;
};

export default TokenRefreshManager;