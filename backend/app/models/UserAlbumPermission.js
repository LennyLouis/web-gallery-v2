const { supabase, supabaseAdmin } = require('../config/database');

class UserAlbumPermission {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.album_id = data.album_id;
    this.permission_type = data.permission_type; // 'view', 'download', 'manage'
    this.granted_by = data.granted_by;
    this.granted_at = data.granted_at;
    this.expires_at = data.expires_at;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(permissionData) {
    const { data, error } = await supabaseAdmin
      .from('user_album_permissions')
      .insert([permissionData])
      .select()
      .single();

    if (error) throw error;
    return new UserAlbumPermission(data);
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('user_album_permissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? new UserAlbumPermission(data) : null;
  }

  static async findByUserAndAlbum(userId, albumId) {
    const { data, error } = await supabase
      .from('user_album_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('album_id', albumId)
      .eq('is_active', true);

    if (error) throw error;
    return data.map(permission => new UserAlbumPermission(permission));
  }

  static async findByAlbum(albumId) {
    console.log(`🔍 UserAlbumPermission.findByAlbum: ${albumId}`);
    
    try {
      // First get the permissions using admin client to bypass RLS
      console.log(`🔍 Querying user_album_permissions table with admin client...`);
      const { data: permissions, error } = await supabaseAdmin
        .from('user_album_permissions')
        .select('*')
        .eq('album_id', albumId)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      if (error) {
        console.error(`❌ Database error in findByAlbum:`, error);
        throw error;
      }

      console.log(`✅ Found ${permissions.length} permissions in database`);

      // Then fetch user info for each permission using admin client
      const permissionsWithUserInfo = await Promise.all(
        permissions.map(async (permission) => {
          try {
            console.log(`👤 Fetching user info for: ${permission.user_id}`);
            const { data: userInfo, error: userError } = await supabaseAdmin.auth.admin.getUserById(permission.user_id);
            
            const result = {
              ...new UserAlbumPermission(permission),
              user_info: userError ? null : {
                id: userInfo?.user?.id || permission.user_id,
                email: userInfo?.user?.email || 'unknown@email.com',
                raw_user_meta_data: userInfo?.user?.user_metadata || userInfo?.user?.raw_user_meta_data || {}
              }
            };
            
            console.log(`👤 Permission with user info:`, JSON.stringify(result, null, 2));
            return result;
          } catch (err) {
            console.warn(`Could not fetch user info for user ${permission.user_id}:`, err);
            return {
              ...new UserAlbumPermission(permission),
              user_info: {
                id: permission.user_id,
                email: 'unknown@email.com',
                raw_user_meta_data: {}
              }
            };
          }
        })
      );

      console.log(`✅ Returning ${permissionsWithUserInfo.length} permissions with user info`);
      return permissionsWithUserInfo;
    } catch (error) {
      console.error(`❌ Error in findByAlbum:`, error);
      throw error;
    }
  }

  static async findByUser(userId) {
    console.log(`👤 UserAlbumPermission.findByUser: ${userId}`);
    
    const { data, error } = await supabaseAdmin
      .from('user_album_permissions')
      .select(`
        *,
        album:albums!album_id (
          id,
          title,
          description,
          owner_id
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('granted_at', { ascending: false });

    if (error) {
      console.error(`❌ Error in findByUser:`, error);
      throw error;
    }
    
    console.log(`👤 Found ${data.length} permissions for user ${userId}`);
    
    return data.map(permission => ({
      ...new UserAlbumPermission(permission),
      album: permission.album
    }));
  }

  static async update(id, updates) {
    const { data, error } = await supabaseAdmin
      .from('user_album_permissions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return new UserAlbumPermission(data);
  }

  static async delete(id) {
    const { error } = await supabaseAdmin
      .from('user_album_permissions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  static async deactivate(id) {
    return this.update(id, { is_active: false });
  }

  // Grant permission to a user for an album
  static async grantPermission(userId, albumId, permissionType, grantedBy, expiresAt = null) {
    // Check if permission already exists
    const { data: existing } = await supabase
      .from('user_album_permissions')
      .select('id')
      .eq('user_id', userId)
      .eq('album_id', albumId)
      .eq('permission_type', permissionType)
      .single();

    if (existing) {
      // Update existing permission
      return this.update(existing.id, {
        is_active: true,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        granted_by: grantedBy,
        granted_at: new Date().toISOString()
      });
    }

    // Create new permission
    return this.create({
      user_id: userId,
      album_id: albumId,
      permission_type: permissionType,
      granted_by: grantedBy,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: true
    });
  }

  // Revoke permission for a user on an album
  static async revokePermission(userId, albumId, permissionType) {
    const { error } = await supabaseAdmin
      .from('user_album_permissions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('album_id', albumId)
      .eq('permission_type', permissionType);

    if (error) throw error;
    return true;
  }

  // Check if user has specific permission on album
  static async hasPermission(userId, albumId, permissionType = 'view') {
    // Reduced verbose logging (toggle with env var if needed)
    const verbose = process.env.PERMISSION_VERBOSE === 'true';
    if (verbose) console.log(`🔐 CHECKING PERMISSION: User ${userId} -> Album ${albumId} (${permissionType})`);
    
    try {
      // First check if user is the owner (owners have all permissions)
      const Album = require('./Album');
      const album = await Album.findById(albumId);
      
      if (album && album.owner_id === userId) {
        if (verbose) console.log(`✅ PERMISSION GRANTED: User is album owner`);
        return true;
      }
      
      // Check if album is public and permission is 'view'
      if (album && album.is_public && permissionType === 'view') {
        if (verbose) console.log(`✅ PERMISSION GRANTED: Album is public and permission is view`);
        return true;
      }
      
      // Define permission hierarchy: download > view, manage > download > view
      const permissionHierarchy = {
        'view': ['view', 'download', 'manage'],
        'download': ['download', 'manage'],
        'manage': ['manage']
      };
      
      const acceptablePermissions = permissionHierarchy[permissionType] || [permissionType];
  if (verbose) console.log(`🔍 Looking for permissions: ${acceptablePermissions.join(', ')}`);
      
      // Check explicit permissions in database
      const { data: permissions, error } = await supabaseAdmin
        .from('user_album_permissions')
        .select('*')
        .eq('user_id', userId)
        .eq('album_id', albumId)
        .in('permission_type', acceptablePermissions)
        .eq('is_active', true);
        
      if (error) {
        console.error(`❌ Database error checking permissions:`, error);
        throw error;
      }
      
  if (verbose) console.log(`🔍 Found ${permissions.length} permissions in database:`, permissions.map(p => p.permission_type));
      
      // Check if any valid permission exists
      const validPermissions = permissions.filter(p => {
        if (!p.expires_at) return true; // No expiry
        return new Date(p.expires_at) > new Date(); // Not expired
      });
      
      const hasValidPermission = validPermissions.length > 0;
  if (verbose) console.log(`${hasValidPermission ? '✅' : '❌'} PERMISSION CHECK: Found ${validPermissions.length} valid permissions`);
      
      if (hasValidPermission && verbose) {
        console.log(`✅ Valid permissions found:`, validPermissions.map(p => `${p.permission_type} (expires: ${p.expires_at || 'never'})`));
      }
      
      return hasValidPermission;
      
    } catch (error) {
      console.error(`❌ Error checking permission:`, error);
      return false;
    }
  }

  // Get all permissions for a user on an album
  static async getUserAlbumPermissions(userId, albumId) {
    const { data, error } = await supabase
      .rpc('get_user_album_permissions', {
        target_user_id: userId,
        target_album_id: albumId
      });

    if (error) throw error;
    return data;
  }

  isValid() {
    if (!this.is_active) return false;
    if (this.expires_at && new Date(this.expires_at) < new Date()) return false;
    return true;
  }

  async getUser() {
    try {
      const { data: userInfo, error } = await supabaseAdmin.auth.admin.getUserById(this.user_id);
      
      if (error) throw error;
      
      return {
        id: userInfo.user.id,
        email: userInfo.user.email,
        raw_user_meta_data: userInfo.user.user_metadata || userInfo.user.raw_user_meta_data
      };
    } catch (error) {
      console.error(`Error fetching user ${this.user_id}:`, error);
      throw error;
    }
  }

  async getAlbum() {
    const Album = require('./Album');
    return Album.findById(this.album_id);
  }
}

module.exports = UserAlbumPermission;