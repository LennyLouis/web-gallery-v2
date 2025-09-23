const { supabase } = require('../config/database');
const crypto = require('crypto');

class AccessLink {
  constructor(data) {
    this.id = data.id;
    this.token = data.token;
    this.album_id = data.album_id;
    this.expires_at = data.expires_at;
    this.is_active = data.is_active;
    this.created_by = data.created_by;
    this.used_count = data.used_count || 0;
    this.max_uses = data.max_uses;
    this.permission_type = data.permission_type || 'view'; // 'view' or 'download'
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static validatePermissionType(permissionType) {
    const validTypes = ['view', 'download'];
    return validTypes.includes(permissionType);
  }

  static async create(linkData) {
    const token = this.generateToken();
    
    // Validate permission_type if provided
    if (linkData.permission_type && !this.validatePermissionType(linkData.permission_type)) {
      throw new Error('Invalid permission type. Must be "view" or "download"');
    }

    const dataToInsert = {
      ...linkData,
      token,
      is_active: true,
      used_count: 0,
      permission_type: linkData.permission_type || 'view' // Default to 'view'
    };

    const { data, error } = await supabase
      .from('access_links')
      .insert([dataToInsert])
      .select()
      .single();

    if (error) throw error;
    return new AccessLink(data);
  }

  static async findByToken(token) {
    const { data, error } = await supabase
      .from('access_links')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? new AccessLink(data) : null;
  }

  static async findByAlbum(albumId) {
    const { data, error } = await supabase
      .from('access_links')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(link => new AccessLink(link));
  }

  static async update(id, updates) {
    const { data, error } = await supabase
      .from('access_links')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return new AccessLink(data);
  }

  static async deactivate(id) {
    return this.update(id, { is_active: false });
  }

  async incrementUsage() {
    return AccessLink.update(this.id, { used_count: this.used_count + 1 });
  }

  isValid() {
    if (!this.is_active) return false;
    if (this.expires_at && new Date(this.expires_at) < new Date()) return false;
    if (this.max_uses && this.used_count >= this.max_uses) return false;
    return true;
  }

  // Check if the access link allows the requested permission
  hasPermission(requiredPermission) {
    if (!this.isValid()) {
      return false;
    }
    
    // 'download' permission includes 'view' permission
    if (requiredPermission === 'view') {
      return true; // Both 'view' and 'download' links allow viewing
    }
    
    if (requiredPermission === 'download') {
      return this.permission_type === 'download';
    }
    
    return false;
  }

  // Get permission level as string for display
  getPermissionLabel() {
    return this.permission_type === 'download' ? 'Téléchargement' : 'Visualisation';
  }

  async getAlbum() {
    const Album = require('./Album');
    return Album.findById(this.album_id);
  }
}

module.exports = AccessLink;