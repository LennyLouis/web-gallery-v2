const UserAlbumPermission = require('../models/UserAlbumPermission');
const Album = require('../models/Album');
const { supabase, supabaseAdmin } = require('../config/database');

const userAlbumPermissionController = {
  // Grant permission to a user for an album
  async grantPermission(req, res) {
    try {
      const { user_email, album_id, permission_type, expires_at } = req.body;

      console.log(`🔐 GRANT PERMISSION: ${user_email} -> Album ${album_id} (${permission_type})`);

      // Verify album exists and user owns it
      const album = await Album.findById(album_id);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only grant permissions for your own albums.' });
      }

      // Find user by email
      const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.listUsers();

      if (userError) {
        throw userError;
      }

      const user = targetUser.users.find(u => u.email === user_email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Grant permission
      const permission = await UserAlbumPermission.grantPermission(
        user.id,
        album_id,
        permission_type,
        req.user.id,
        expires_at
      );

      console.log(`✅ PERMISSION GRANTED: ${permission.id}`);

      res.status(201).json({
        message: 'Permission granted successfully',
        permission: {
          ...permission,
          user_email: user_email,
          album_title: album.title
        }
      });

    } catch (error) {
      console.error('Grant permission error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Revoke permission for a user on an album
  async revokePermission(req, res) {
    try {
      const { user_id, album_id, permission_type } = req.body;

      console.log(`🔒 REVOKE PERMISSION: User ${user_id} -> Album ${album_id} (${permission_type})`);

      // Verify album exists and user owns it
      const album = await Album.findById(album_id);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only revoke permissions for your own albums.' });
      }

      await UserAlbumPermission.revokePermission(user_id, album_id, permission_type);

      console.log(`✅ PERMISSION REVOKED`);

      res.json({
        message: 'Permission revoked successfully'
      });

    } catch (error) {
      console.error('Revoke permission error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get all permissions for an album
  async getAlbumPermissions(req, res) {
    try {
      const { albumId } = req.params;

      console.log(`📋 GET ALBUM PERMISSIONS: ${albumId}`);
      console.log(`👤 Request user:`, req.user.id);

      // Verify album exists and user owns it
      const album = await Album.findById(albumId);
      if (!album) {
        console.log(`❌ Album not found: ${albumId}`);
        return res.status(404).json({ error: 'Album not found' });
      }

      console.log(`📁 Album found: ${album.title}, owner: ${album.owner_id}`);

      if (album.owner_id !== req.user.id) {
        console.log(`❌ Access denied: Album owner=${album.owner_id}, User=${req.user.id}`);
        return res.status(403).json({ error: 'Access denied. You can only view permissions for your own albums.' });
      }

      console.log(`🔍 Fetching permissions for album ${albumId}...`);
      const permissions = await UserAlbumPermission.findByAlbum(albumId);

      console.log(`📋 FOUND ${permissions.length} permissions`);
      console.log(`📋 Permissions details:`, JSON.stringify(permissions, null, 2));

      const formattedPermissions = permissions.map(permission => {
        const formatted = {
          ...permission,
          album_title: album.title,
          is_valid: permission.isValid ? permission.isValid() : true
        };
        console.log(`📋 Formatted permission:`, JSON.stringify(formatted, null, 2));
        return formatted;
      });

      res.json({
        permissions: formattedPermissions
      });

    } catch (error) {
      console.error('❌ Get album permissions error:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({ error: 'Server error: ' + error.message });
    }
  },

  // Get all permissions for a user
  async getUserPermissions(req, res) {
    try {
      const userId = req.user.id; // Current user's permissions

      console.log(`👤 GET USER PERMISSIONS: ${userId}`);

      const permissions = await UserAlbumPermission.findByUser(userId);

      console.log(`👤 FOUND ${permissions.length} permissions for user`);

      res.json({
        permissions: permissions.map(permission => ({
          ...permission,
          is_valid: permission.isValid()
        }))
      });

    } catch (error) {
      console.error('Get user permissions error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Check if current user has permission on album
  async checkPermission(req, res) {
    try {
      const { albumId } = req.params;
      const { permission } = req.query; // 'view', 'download', 'manage'
      const permissionType = permission || 'view';

      console.log(`🔍 CHECK PERMISSION: User ${req.user.id} -> Album ${albumId} (${permissionType})`);

      const hasPermission = await UserAlbumPermission.hasPermission(
        req.user.id,
        albumId,
        permissionType
      );

      console.log(`🔍 PERMISSION RESULT: ${hasPermission}`);

      res.json({
        has_permission: hasPermission,
        user_id: req.user.id,
        album_id: albumId,
        permission_type: permissionType
      });

    } catch (error) {
      console.error('Check permission error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get detailed permissions for user on album
  async getDetailedPermissions(req, res) {
    try {
      const { albumId } = req.params;
      const userId = req.user.id;

      console.log(`🔍 GET DETAILED PERMISSIONS: User ${userId} -> Album ${albumId}`);

      const permissions = await UserAlbumPermission.getUserAlbumPermissions(userId, albumId);

      console.log(`🔍 DETAILED PERMISSIONS:`, permissions);

      res.json({
        user_id: userId,
        album_id: albumId,
        permissions: permissions
      });

    } catch (error) {
      console.error('Get detailed permissions error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Update permission (extend expiry, change type, etc.)
  async updatePermission(req, res) {
    try {
      const { id } = req.params;
      const { permission_type, expires_at, is_active } = req.body;

      console.log(`🔄 UPDATE PERMISSION: ${id}`);

      // Get current permission to verify ownership
      const permission = await UserAlbumPermission.findById(id);
      if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      // Verify album ownership
      const album = await Album.findById(permission.album_id);
      if (!album || album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = {};
      if (permission_type !== undefined) updates.permission_type = permission_type;
      if (expires_at !== undefined) {
        updates.expires_at = expires_at ? new Date(expires_at).toISOString() : null;
      }
      if (is_active !== undefined) updates.is_active = is_active;

      const updatedPermission = await UserAlbumPermission.update(id, updates);

      console.log(`✅ PERMISSION UPDATED: ${updatedPermission.id}`);

      res.json({
        message: 'Permission updated successfully',
        permission: updatedPermission
      });

    } catch (error) {
      console.error('Update permission error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Delete permission
  async deletePermission(req, res) {
    try {
      const { id } = req.params;

      console.log(`🗑️ DELETE PERMISSION: ${id}`);

      // Get current permission to verify ownership
      const permission = await UserAlbumPermission.findById(id);
      if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      // Verify album ownership
      const album = await Album.findById(permission.album_id);
      if (!album || album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await UserAlbumPermission.delete(id);

      console.log(`✅ PERMISSION DELETED`);

      res.json({
        message: 'Permission deleted successfully'
      });

    } catch (error) {
      console.error('Delete permission error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Invite user by email (creates user if doesn't exist, then grants permission)
  async inviteUser(req, res) {
    try {
      const { email, album_id, permission_type, expires_at } = req.body;

      console.log(`📧 INVITE USER: ${email} -> Album ${album_id} (${permission_type})`);

      // Verify album exists and user owns it
      const album = await Album.findById(album_id);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Try to find existing user
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        throw listError;
      }

      let targetUser = existingUsers.users.find(u => u.email === email);

      if (!targetUser) {
        // Create new user with temporary password
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: Math.random().toString(36).slice(-12), // temporary password
          email_confirm: true,
          user_metadata: {
            invited_to_album: album_id,
            invited_by: req.user.email
          }
        });

        if (createError) {
          throw createError;
        }

        targetUser = newUser.user;
        console.log(`👤 NEW USER CREATED: ${targetUser.id}`);
      }

      // Grant permission
      const permission = await UserAlbumPermission.grantPermission(
        targetUser.id,
        album_id,
        permission_type,
        req.user.id,
        expires_at
      );

      console.log(`✅ USER INVITED & PERMISSION GRANTED`);

      res.status(201).json({
        message: 'User invited successfully',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          created: !existingUsers.users.find(u => u.email === email)
        },
        permission: {
          ...permission,
          album_title: album.title
        }
      });

    } catch (error) {
      console.error('Invite user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = userAlbumPermissionController;