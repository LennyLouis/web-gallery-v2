import { createClient } from '@supabase/supabase-js';

// Ces variables seront récupérées depuis les variables d'environnement
// Pour React Router v7 SPA mode, nous utilisons import.meta.env
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
};

export type Album = {
  id: string;
  title: string;
  description?: string;
  date?: string;
  tags?: string[];
  location?: string;
  is_public: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
  photo_count?: number;
};

export type Photo = {
  id: string;
  filename: string;
  original_name: string;
  file_path: string;
  preview_path: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  album_id: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
};

// API helpers pour communiquer avec notre backend Node.js
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';
const API_URL = `${API_BASE_URL}/api`;

// Auth helpers using Supabase directly
export const auth = {
  async login(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || data.user.email!,
          role: data.user.user_metadata?.role || 'user',
        },
        session: data.session,
      };
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  },

  async register(email: string, password: string, name?: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email,
            role: 'user',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    }
  },

  async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        session: data.session,
      };
    } catch (error) {
      return { success: false, error: 'Token refresh failed' };
    }
  },

  async logout() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Logout failed' };
    }
  },

  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, session };
    } catch (error) {
      return { success: false, error: 'Failed to get session' };
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export const api = {

  async validateAccessLink(token: string) {
    const response = await fetch(`${API_URL}/access-links/validate/${token}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Invalid access link' };
    }

    const data = await response.json();
    return {
      success: data.valid,
      album: data.album,
      accessLink: data.access_link
    };
  },

  // Albums endpoints
  async getAlbums(): Promise<{ albums: Album[] }> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${API_URL}/albums`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch albums');
    }

    return response.json();
  },

  async getAlbum(id: string, accessToken?: string): Promise<{ album: Album }> {
    let token = accessToken;

    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      token = session.access_token;
    }

    const response = await fetch(`${API_URL}/albums/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch album');
    }

    return response.json();
  },

  // Photos endpoints
  async getPhotos(albumId: string, accessToken?: string): Promise<{ photos: Photo[] }> {
    let token = accessToken;

    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      token = session.access_token;
    }

    const response = await fetch(`${API_URL}/photos/${albumId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch photos');
    }

    return response.json();
  },

  async downloadPhotos(photoIds: string[], accessToken?: string) {
    let token = accessToken;

    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      token = session.access_token;
    }

    const response = await fetch(`${API_URL}/photos/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ photoIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to download photos');
    }

    return response.json();
  },
};