const { supabase, supabaseAdmin } = require('../config/database');

const userController = {
  // Get all users (admin only)
  async getUsers(req, res) {
    try {
      console.log(`👥 GET ALL USERS - Requested by: ${req.user.email}`);

      // Check if user is admin
      if (!req.user.user_metadata?.role || req.user.user_metadata.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      // Get all users from Supabase Auth
      const { data: authData, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      // Format users data
      const users = authData.users.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        role: user.user_metadata?.role || 'user',
        metadata: user.user_metadata || {},
        is_anonymous: user.is_anonymous || false
      }));

      console.log(`👥 FOUND ${users.length} users`);

      res.json({
        users: users,
        total: users.length
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get current user profile
  async getProfile(req, res) {
    try {
      console.log(`👤 GET PROFILE: ${req.user.id}`);

      const user = {
        id: req.user.id,
        email: req.user.email,
        created_at: req.user.created_at,
        last_sign_in_at: req.user.last_sign_in_at,
        email_confirmed_at: req.user.email_confirmed_at,
        role: req.user.user_metadata?.role || 'user',
        metadata: req.user.user_metadata || {},
        is_anonymous: req.user.is_anonymous || false
      };

      res.json({ user });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get user by ID (admin only)
  async getUserById(req, res) {
    try {
      const { id } = req.params;

      console.log(`� GET USER BY ID: ${id} - Requested by: ${req.user.email}`);

      // Check if user is admin or requesting their own data
      if (!req.user.user_metadata?.role || 
          (req.user.user_metadata.role !== 'admin' && req.user.id !== id)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: userInfo, error } = await supabaseAdmin.auth.admin.getUserById(id);

      if (error) {
        if (error.message.includes('User not found')) {
          return res.status(404).json({ error: 'User not found' });
        }
        throw error;
      }

      const user = {
        id: userInfo.user.id,
        email: userInfo.user.email,
        created_at: userInfo.user.created_at,
        last_sign_in_at: userInfo.user.last_sign_in_at,
        email_confirmed_at: userInfo.user.email_confirmed_at,
        role: userInfo.user.user_metadata?.role || 'user',
        metadata: userInfo.user.user_metadata || {},
        is_anonymous: userInfo.user.is_anonymous || false
      };

      console.log(`👤 USER FOUND: ${user.email}`);

      res.json({ user });

    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = userController;