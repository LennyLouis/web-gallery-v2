const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabase } = require('../config/database');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.user_metadata?.role || 'user';

    if (role === 'admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  };
};

const authenticateAccessLink = async (req, res, next) => {
  try {
    const { token } = req.params;
    const AccessLink = require('../models/AccessLink');

    if (!token) {
      return res.status(400).json({ error: 'Access token required' });
    }

    const accessLink = await AccessLink.findByToken(token);

    if (!accessLink || !accessLink.isValid()) {
      return res.status(403).json({ error: 'Invalid or expired access link' });
    }

    // Increment usage count
    await accessLink.incrementUsage();

    req.accessLink = accessLink;
    next();
  } catch (error) {
    console.error('Access link auth error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  authenticateAccessLink
};