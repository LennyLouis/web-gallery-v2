import { createClient } from '@supabase/supabase-js';

// Ces variables seront récupérées depuis les variables d'environnement
// Pour React Router v7 SPA mode, nous utilisons import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
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
  cover_photo_url?: string;
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
  // URLs signées ajoutées par le backend
  download_url?: string;
  preview_url?: string;
};

export type UserAlbumPermission = {
  id: string;
  user_id: string;
  album_id: string;
  permission_type: 'view' | 'download' | 'manage';
  granted_by: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_email?: string;
  album_title?: string;
  user_name?: string;
  is_valid?: boolean;
};

// Note: API calls are now handled by the generated OpenAPI client

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

// Import the simple API client
import { apiClient } from './apiClient';

export const api = {

  async validateAccessLink(token: string) {
    try {
      const data = await apiClient.validateAccessLink(token);
      return {
        success: data.valid || false,
        album: data.album,
        accessLink: data.access_link
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid access link'
      };
    }
  },

  // Albums endpoints
  async getAlbums(accessToken?: string): Promise<{ albums: Album[] }> {
    let token = accessToken;

    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      token = session.access_token;
    }

    const data = await apiClient.getAlbums(token);
    return { albums: data.albums || [] };
  },

  async getAlbum(id: string, accessToken?: string): Promise<{ album: Album }> {
    if (accessToken) {
      const data = await apiClient.getAlbumByAccessToken(accessToken);
      return { album: data.album as Album };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    console.log('getAlbum using token:', session.access_token.substring(0, 10) + '...');
    const data = await apiClient.getAlbum(id, session.access_token);
    return { album: data.album as Album };
  },

  // Photos endpoints
  async getPhotos(albumId: string, accessToken?: string): Promise<{ photos: Photo[] }> {
    if (accessToken) {
      const data = await apiClient.getPhotosByAccessToken(albumId, accessToken);
      return { photos: data.photos || [] };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    console.log('getPhotos using token:', session.access_token.substring(0, 10) + '...');

    try {
      const data = await apiClient.getPhotos(albumId, session.access_token);
      return { photos: data.photos || [] };
    } catch (error: any) {
      // If token error, try refresh once and retry
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('Token failed, trying refresh...');
        const { data: { session: newSession } } = await supabase.auth.refreshSession();
        if (newSession) {
          console.log('Retrying with refreshed token...');
          const retryData = await apiClient.getPhotos(albumId, newSession.access_token);
          return { photos: retryData.photos || [] };
        }
      }
      throw error;
    }
  },

  async downloadPhotos(photoIds: string[], accessToken?: string) {
    if (accessToken) {
      return await apiClient.downloadPhotosByAccessToken(photoIds, accessToken);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.downloadPhotos(photoIds, session.access_token);
  },

  // Admin endpoints
  async createAlbum(albumData: any): Promise<{ album: Album }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.createAlbum(albumData, session.access_token);
  },

  async updateAlbum(id: string, albumData: any): Promise<{ album: Album }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.updateAlbum(id, albumData, session.access_token);
  },

  async deleteAlbum(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.deleteAlbum(id, session.access_token);
  },

  async uploadPhotos(albumId: string, files: FileList): Promise<{ photos: any[] }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('photos', file);
    });

    return await apiClient.uploadPhotos(albumId, formData, session.access_token);
  },

  async deletePhoto(photoId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.deletePhoto(photoId, session.access_token);
  },

  async setCoverPhoto(albumId: string, photoId: string): Promise<{ album: Album }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.setCoverPhoto(albumId, photoId, session.access_token);
  },

  // Access links management
  async createAccessLink(albumId: string, expiresAt?: string, maxUses?: number, permissionType?: 'view' | 'download'): Promise<{ access_link: any }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.createAccessLink(albumId, session.access_token, expiresAt, maxUses, permissionType);
  },

  async getAlbumAccessLinks(albumId: string): Promise<{ access_links: any[] }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.getAlbumAccessLinks(albumId, session.access_token);
  },

  async updateAccessLink(linkId: string, updates: any): Promise<{ access_link: any }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.updateAccessLink(linkId, updates, session.access_token);
  },

  async deleteAccessLink(linkId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.deleteAccessLink(linkId, session.access_token);
  },

  // User management
  async getUsers(): Promise<{ users: any[] }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.getUsers(session.access_token);
  },

  async getAlbumUsers(albumId: string): Promise<{ users: any[] }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.getAlbumUsers(albumId, session.access_token);
  },

  async addUserToAlbum(albumId: string, userId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.addUserToAlbum(albumId, userId, session.access_token);
  },

  async removeUserFromAlbum(albumId: string, userId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.removeUserFromAlbum(albumId, userId, session.access_token);
  },

  async inviteUserByEmail(albumId: string, email: string): Promise<{ user: any }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.inviteUserByEmail(albumId, email, session.access_token);
  },

  // Permissions management
  async grantPermission(userEmail: string, albumId: string, permissionType: 'view' | 'download' | 'manage', expiresAt?: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.grantPermission({
      user_email: userEmail,
      album_id: albumId,
      permission_type: permissionType,
      expires_at: expiresAt,
    }, session.access_token);
  },

  async revokePermission(userId: string, albumId: string, permissionType: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.revokePermission(userId, albumId, permissionType, session.access_token);
  },

  async inviteUserWithPermission(email: string, albumId: string, permissionType: 'view' | 'download' | 'manage' = 'view', expiresAt?: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.inviteUserWithPermission(email, albumId, permissionType, session.access_token, expiresAt);
  },

  async getAlbumPermissions(albumId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.getAlbumPermissions(albumId, session.access_token);
  },

  async getUserPermissions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.getUserPermissions(session.access_token);
  },

  async checkPermission(albumId: string, permission: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.checkPermission(albumId, permission, session.access_token);
  },

  async getDetailedPermissions(albumId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.getDetailedPermissions(albumId, session.access_token);
  },

  async updatePermission(permissionId: string, updates: {
    permission_type?: 'view' | 'download' | 'manage';
    expires_at?: string;
    is_active?: boolean;
  }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.updatePermission(permissionId, updates, session.access_token);
  },

  async deletePermission(permissionId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    return await apiClient.deletePermission(permissionId, session.access_token);
  },
};