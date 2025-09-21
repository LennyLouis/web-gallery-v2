import { useEffect, useRef } from 'react';
import { useAuth } from '~/contexts/AuthContext';

// Hook pour gérer le refresh automatique des tokens
export const useTokenRefresh = () => {
  const { session, refreshSession } = useAuth();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      if (!session?.expires_at) return;

      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      // Refresh 5 minutes before expiration
      const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 60000); // Minimum 1 minute

      if (refreshTime > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          try {
            console.log('Auto-refreshing token...');
            await refreshSession();
          } catch (error) {
            console.error('Token refresh failed:', error);
          }
        }, refreshTime);
      }
    };

    scheduleRefresh();

    // Cleanup on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [session, refreshSession]);

  const manualRefresh = async () => {
    try {
      const result = await refreshSession();
      if (result.success) {
        console.log('Manual token refresh successful');
      } else {
        console.error('Manual token refresh failed:', result.error);
      }
      return result;
    } catch (error) {
      console.error('Manual token refresh error:', error);
      return { success: false, error: 'Refresh failed' };
    }
  };

  return {
    manualRefresh,
    expiresAt: session?.expires_at,
    isExpired: session?.expires_at ? Date.now() / 1000 > session.expires_at : false,
  };
};