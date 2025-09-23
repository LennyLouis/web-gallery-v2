const { supabase, supabaseAdmin } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Use regular supabase client with the user's token to verify session
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Try to get more specific error info
      if (error?.message?.includes('expired')) {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
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

const authenticateTokenOrAccessToken = async (req, res, next) => {
  try {
    // Vérifier s'il y a un token d'accès dans les paramètres de requête
    const { access_token } = req.query;
    
    if (access_token) {
      const AccessLink = require('../models/AccessLink');
      
      const accessLink = await AccessLink.findByToken(access_token);
      
      if (!accessLink || !accessLink.is_active) {
        return res.status(401).json({ error: 'Invalid access token' });
      }
      
      if (!accessLink.isValid()) {
        return res.status(401).json({ error: 'Access token expired or reached usage limit' });
      }
      
      req.accessLink = accessLink;
      return next();
    }
    
    // Sinon, utiliser l'authentification normale par token JWT
    return authenticateToken(req, res, next);
    
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({ error: 'Authentication failed' });
  }
};

// Middleware pour vérifier les permissions d'accès selon l'action demandée
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      // Si l'utilisateur est authentifié avec un token JWT, il a toutes les permissions
      if (req.user && !req.accessLink) {
        return next();
      }
      
      // Si c'est un accès par lien d'accès, vérifier les permissions du lien
      if (req.accessLink) {
        const hasPermission = req.accessLink.hasPermission(requiredPermission);
        
        if (hasPermission) {
          return next();
        } else {
          return res.status(403).json({ 
            error: `Access denied. This link only allows ${req.accessLink.permission_type} access.`,
            required_permission: requiredPermission,
            granted_permission: req.accessLink.permission_type
          });
        }
      }
      
      // Aucune authentification valide
      return res.status(401).json({ error: 'Authentication required' });
      
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  authenticateAccessLink,
  authenticateTokenOrAccessToken,
  requirePermission
};