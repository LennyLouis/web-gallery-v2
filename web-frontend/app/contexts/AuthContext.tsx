import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, auth, type User } from '~/lib/supabase';
import { apiClient } from '~/lib/apiClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSessionValid: () => boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  validateAccessLink: (token: string) => Promise<{ success: boolean; error?: string; album?: any; accessLink?: any }>;
  refreshSession: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle automatic logout on token expiry
  const handleTokenExpired = () => {
    setSession(null);
    setUser(null);
  };

  // Check if current session is valid
  const isSessionValid = () => {
    if (!session || !session.expires_at) return false;
    const now = Math.floor(Date.now() / 1000);
    return session.expires_at > now;
  };

  // Configure API client to handle expired tokens
  useEffect(() => {
    apiClient.setTokenExpiredCallback(handleTokenExpired);
  }, []);

  useEffect(() => {
    // Skip during SSR or hydration
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Delay initialization to ensure client-side only
    const initAuth = async () => {
      try {
        // Récupérer la session initiale
        const { session } = await auth.getSession();
        if (session) {
          // Check if token is expired
          const now = Math.floor(Date.now() / 1000);
          if (session.expires_at && session.expires_at <= now) {
            // Session is expired, clear it
            setSession(null);
            setUser(null);
          } else {
            setSession(session);
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata?.name || session.user.email!,
              role: session.user.user_metadata?.role || 'user',
            });
          }
        }
      } catch (error) {
        console.error('Session error:', error);
        // Clear session on error
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Slight delay to ensure we're fully client-side
    const timeoutId = setTimeout(initAuth, 100);

    // Écouter les changements d'authentification
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setSession(session);
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name || session.user.email!,
          role: session.user.user_metadata?.role || 'user',
        });
      } else {
        setSession(null);
        setUser(null);
      }

      // Auto-refresh des tokens expirés
      if (event === 'TOKEN_REFRESHED') {
      }

      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Auto-refresh timer
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
            await refreshSession();
          } catch (error) {
            console.error('Auto-refresh failed:', error);
          }
        }, refreshTime);
      }
    };

    scheduleRefresh();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [session]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    const result = await auth.login(email, password);
    setLoading(false);
    return result;
  };

  const register = async (email: string, password: string, name?: string) => {
    setLoading(true);
    const result = await auth.register(email, password, name);
    setLoading(false);
    return result;
  };

  const refreshSession = async () => {
    setLoading(true);
    try {
      const result = await auth.refreshSession();

      // If refresh successful, update the local session state immediately
      if (result.success && result.session) {
        setSession(result.session);
        setUser({
          id: result.session.user.id,
          email: result.session.user.email!,
          name: result.session.user.user_metadata?.name || result.session.user.email!,
          role: result.session.user.user_metadata?.role || 'user',
        });
      }

      return result;
    } finally {
      setLoading(false);
    }
  };

  const validateAccessLink = async (accessToken: string) => {
    setLoading(true);
    try {
      const result = await apiClient.validateAccessLink(accessToken);
      return {
        success: result.valid || false,
        album: result.album,
        accessLink: result.access_link
      };
    } catch (error) {
      console.error('Access link validation error:', error);
      return { success: false, error: 'Erreur de validation du lien' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Try to logout properly first
      await auth.logout();
    } catch (error) {
      // If logout fails (expired session), just clear local state
    } finally {
      // Always clear local state regardless of server response
      setSession(null);
      setUser(null);
      setLoading(false);
    }
    return { success: true };
  };

  const value = {
    user,
    session,
    loading,
    isSessionValid,
    login,
    register,
    validateAccessLink,
    refreshSession,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};