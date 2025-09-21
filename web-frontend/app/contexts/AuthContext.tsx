import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, auth, api, type User } from '~/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  validateAccessLink: (token: string) => Promise<{ success: boolean; error?: string; album?: any }>;
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

  useEffect(() => {
    // Récupérer la session initiale
    auth.getSession().then(({ session }) => {
      if (session) {
        setSession(session);
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name || session.user.email!,
          role: session.user.user_metadata?.role || 'user',
        });
      }
      setLoading(false);
    });

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
        console.log('Token refreshed successfully');
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
            console.log('Auto-refreshing token...');
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
    const result = await auth.refreshSession();
    setLoading(false);
    return result;
  };

  const validateAccessLink = async (accessToken: string) => {
    setLoading(true);
    try {
      const result = await api.validateAccessLink(accessToken);
      return result;
    } catch (error) {
      console.error('Access link validation error:', error);
      return { success: false, error: 'Erreur de validation du lien' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    const result = await auth.logout();
    setLoading(false);
    return result;
  };

  const value = {
    user,
    session,
    loading,
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