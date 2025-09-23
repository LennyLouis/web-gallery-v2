import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

// Types for our API responses
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface Album {
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
}

export interface AccessLink {
  id: string;
  album_id: string;
  token: string;
  expires_at?: string;
  max_uses?: number;
  uses_count: number;
  is_active: boolean;
  created_at: string;
}

export interface UserAlbumPermission {
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
}

export interface PermissionGrant {
  user_email: string;
  album_id: string;
  permission_type: 'view' | 'download' | 'manage';
  expires_at?: string;
}

export interface CreateAlbum {
  title: string;
  description?: string;
  date?: string;
  tags?: string[];
  location?: string;
  is_public: boolean;
}

class ApiClient {
  private client: AxiosInstance;
  private onTokenExpired?: () => void;

  constructor() {
    const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor to handle expired tokens
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle both 401 and 403 for token expiry
        if ((error.response?.status === 401 || error.response?.status === 403) && this.onTokenExpired) {
          const errorMessage = error.response?.data?.error || '';
          if (errorMessage.includes('expired') || errorMessage.includes('Invalid or expired token')) {
            console.log('Token expired, triggering logout');
            this.onTokenExpired();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setTokenExpiredCallback(callback: () => void) {
    this.onTokenExpired = callback;
  }

  private createAuthConfig(token: string): AxiosRequestConfig {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/api/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  }

  // Albums endpoints
  async getAlbums(token: string): Promise<{ albums: Album[] }> {
    const response = await this.client.get('/api/albums', this.createAuthConfig(token));
    return response.data;
  }

  async getAlbum(albumId: string, token: string): Promise<{ album: Album }> {
    const response = await this.client.get(`/api/albums/${albumId}`, this.createAuthConfig(token));
    return response.data;
  }

  async createAlbum(albumData: CreateAlbum, token: string): Promise<{ album: Album }> {
    const response = await this.client.post('/api/albums', albumData, this.createAuthConfig(token));
    return response.data;
  }

  async updateAlbum(albumId: string, albumData: Partial<CreateAlbum>, token: string): Promise<{ album: Album }> {
    const response = await this.client.put(`/api/albums/${albumId}`, albumData, this.createAuthConfig(token));
    return response.data;
  }

  async deleteAlbum(albumId: string, token: string): Promise<void> {
    await this.client.delete(`/api/albums/${albumId}`, this.createAuthConfig(token));
  }

  // Public albums
  async getPublicAlbums(): Promise<{ albums: Album[] }> {
    const response = await this.client.get('/api/albums/public');
    return response.data;
  }

  // Access token album access
  async getAlbumByAccessToken(accessToken: string): Promise<{ album: Album }> {
    const response = await this.client.get(`/api/albums/access/${accessToken}`);
    return response.data;
  }

  // Access links
  async validateAccessLink(token: string) {
    const response = await this.client.get(`/api/access-links/validate/${token}`);
    return response.data;
  }

  async createAccessLink(albumId: string, token: string, expiresAt?: string, maxUses?: number, permissionType?: 'view' | 'download'): Promise<{ access_link: AccessLink }> {
    const response = await this.client.post('/api/access-links', {
      album_id: albumId,
      expires_at: expiresAt,
      max_uses: maxUses,
      permission_type: permissionType || 'view',
    }, this.createAuthConfig(token));
    return response.data;
  }

  async getAccessLinks(token: string): Promise<{ access_links: AccessLink[] }> {
    const response = await this.client.get('/api/access-links', this.createAuthConfig(token));
    return response.data;
  }

  async getAlbumAccessLinks(albumId: string, token: string): Promise<{ access_links: AccessLink[] }> {
    const response = await this.client.get(`/api/access-links/album/${albumId}`, this.createAuthConfig(token));
    return response.data;
  }

  async updateAccessLink(linkId: string, updates: {
    expires_at?: string;
    max_uses?: number;
    is_active?: boolean;
  }, token: string): Promise<{ access_link: AccessLink }> {
    const response = await this.client.put(`/api/access-links/${linkId}`, updates, this.createAuthConfig(token));
    return response.data;
  }

  async deleteAccessLink(linkId: string, token: string): Promise<void> {
    await this.client.delete(`/api/access-links/${linkId}`, this.createAuthConfig(token));
  }

  // Photos endpoints
  async getPhotos(albumId: string, token: string): Promise<{ photos: any[] }> {
    const response = await this.client.get(`/api/photos/album/${albumId}`, this.createAuthConfig(token));
    return response.data;
  }

  async getPhotosByAccessToken(albumId: string, accessToken: string): Promise<{ photos: any[] }> {
    // Pour les tokens d'accès, passer le token comme paramètre
    const response = await this.client.get(`/api/photos/album/${albumId}?access_token=${accessToken}`);
    return response.data;
  }

  async downloadPhotos(photoIds: string[], token: string): Promise<void> {
    const config = {
      ...this.createAuthConfig(token),
      responseType: 'blob' as const,
    };
    
    const response = await this.client.post('/api/photos/download', {
      photoIds: photoIds
    }, config);
    
    // Create a blob URL and trigger download
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photos-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  async downloadPhotosByAccessToken(photoIds: string[], accessToken: string): Promise<void> {
    const response = await this.client.post(`/api/photos/download?access_token=${accessToken}`, {
      photoIds: photoIds
    }, {
      responseType: 'blob' as const,
    });
    
    // Create a blob URL and trigger download
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photos-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Photo upload endpoints
  async uploadPhotos(albumId: string, formData: FormData, token: string): Promise<{ photos: any[] }> {
    const response = await this.client.post(`/api/photos/upload/${albumId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async deletePhoto(photoId: string, token: string): Promise<void> {
    await this.client.delete(`/api/photos/${photoId}`, this.createAuthConfig(token));
  }

  async setCoverPhoto(albumId: string, photoId: string, token: string): Promise<{ album: Album }> {
    const response = await this.client.put(`/api/albums/${albumId}/cover`,
      { cover_photo_id: photoId },
      this.createAuthConfig(token)
    );
    return response.data;
  }

  // User management endpoints (admin only)
  async getUsers(token: string): Promise<{ users: User[] }> {
    const response = await this.client.get('/api/users', this.createAuthConfig(token));
    return response.data;
  }

  async getAlbumUsers(albumId: string, token: string): Promise<{ users: User[] }> {
    const response = await this.client.get(`/api/albums/${albumId}/users`, this.createAuthConfig(token));
    return response.data;
  }

  async addUserToAlbum(albumId: string, userId: string, token: string): Promise<void> {
    await this.client.post(`/api/albums/${albumId}/users`, { user_id: userId }, this.createAuthConfig(token));
  }

  async removeUserFromAlbum(albumId: string, userId: string, token: string): Promise<void> {
    await this.client.delete(`/api/albums/${albumId}/users/${userId}`, this.createAuthConfig(token));
  }

  async inviteUserByEmail(albumId: string, email: string, token: string): Promise<{ user: User }> {
    const response = await this.client.post(`/api/albums/${albumId}/invite`,
      { email },
      this.createAuthConfig(token)
    );
    return response.data;
  }

  // Permissions endpoints
  async grantPermission(permissionData: PermissionGrant, token: string): Promise<{ permission: UserAlbumPermission }> {
    const response = await this.client.post('/api/permissions/grant', permissionData, this.createAuthConfig(token));
    return response.data;
  }

  async revokePermission(userId: string, albumId: string, permissionType: string, token: string): Promise<void> {
    await this.client.post('/api/permissions/revoke', {
      user_id: userId,
      album_id: albumId,
      permission_type: permissionType,
    }, this.createAuthConfig(token));
  }

  async inviteUserWithPermission(email: string, albumId: string, permissionType: 'view' | 'download' | 'manage', token: string, expiresAt?: string): Promise<{ user: User; permission: UserAlbumPermission }> {
    const response = await this.client.post('/api/permissions/invite', {
      email,
      album_id: albumId,
      permission_type: permissionType,
      expires_at: expiresAt,
    }, this.createAuthConfig(token));
    return response.data;
  }

  async getAlbumPermissions(albumId: string, token: string): Promise<{ permissions: UserAlbumPermission[] }> {
    const response = await this.client.get(`/api/permissions/album/${albumId}`, this.createAuthConfig(token));
    return response.data;
  }

  async getUserPermissions(token: string): Promise<{ permissions: UserAlbumPermission[] }> {
    const response = await this.client.get('/api/permissions/user', this.createAuthConfig(token));
    return response.data;
  }

  async checkPermission(albumId: string, permission: string, token: string): Promise<{ has_permission: boolean }> {
    const response = await this.client.get(`/api/permissions/check/${albumId}?permission=${permission}`, this.createAuthConfig(token));
    return response.data;
  }

  async getDetailedPermissions(albumId: string, token: string): Promise<{ permissions: any }> {
    const response = await this.client.get(`/api/permissions/detailed/${albumId}`, this.createAuthConfig(token));
    return response.data;
  }

  async updatePermission(permissionId: string, updates: {
    permission_type?: 'view' | 'download' | 'manage';
    expires_at?: string;
    is_active?: boolean;
  }, token: string): Promise<{ permission: UserAlbumPermission }> {
    const response = await this.client.put(`/api/permissions/${permissionId}`, updates, this.createAuthConfig(token));
    return response.data;
  }

  async deletePermission(permissionId: string, token: string): Promise<void> {
    await this.client.delete(`/api/permissions/${permissionId}`, this.createAuthConfig(token));
  }
}

export const apiClient = new ApiClient();
export type { AxiosRequestConfig };