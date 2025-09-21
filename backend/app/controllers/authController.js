const { supabase, supabaseAdmin } = require('../config/database');

const authController = {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: error.message
        });
      }

      res.json({
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.user_metadata?.role || 'user'
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async register(req, res) {
    try {
      const { email, password, role = 'user' } = req.body;

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role
        }
      });

      if (error) {
        return res.status(400).json({
          error: 'Registration failed',
          message: error.message
        });
      }

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.user_metadata?.role || 'user'
        }
      });

    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async refreshToken(req, res) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token
      });

      if (error) {
        return res.status(401).json({
          error: 'Invalid refresh token',
          message: error.message
        });
      }

      res.json({
        message: 'Token refreshed successfully',
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }
      });

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async logout(req, res) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        await supabase.auth.signOut();
      }

      res.json({ message: 'Logout successful' });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async profile(req, res) {
    try {
      const user = req.user;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.user_metadata?.role || 'user',
          created_at: user.created_at
        }
      });

    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = authController;