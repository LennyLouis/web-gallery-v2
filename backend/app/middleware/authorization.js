const Album = require('../models/Album');
const AccessLink = require('../models/AccessLink');
const { supabase } = require('../config/database');

const authorization = {
  // Vérifier l'accès à un album (propriétaire ou album public)
  async checkAlbumAccess(req, res, next) {
    try {
      const { albumId, id } = req.params;
      const targetAlbumId = albumId || id;

      if (!targetAlbumId) {
        return res.status(400).json({ error: 'Album ID required' });
      }

      const album = await Album.findById(targetAlbumId);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      // Vérifier l'accès : propriétaire ou album public
      const hasAccess = album.owner_id === req.user.id || album.is_public;

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this album' });
      }

      req.album = album;
      next();

    } catch (error) {
      console.error('Album access check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Vérifier la propriété d'un album (pour modifications)
  async checkAlbumOwnership(req, res, next) {
    try {
      const { albumId, id } = req.params;
      const targetAlbumId = albumId || id;

      if (!targetAlbumId) {
        return res.status(400).json({ error: 'Album ID required' });
      }

      const album = await Album.findById(targetAlbumId);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only modify your own albums' });
      }

      req.album = album;
      next();

    } catch (error) {
      console.error('Album ownership check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Vérifier l'accès via lien d'accès
  async checkAccessLink(req, res, next) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ error: 'Access token required' });
      }

      // Vérifier et valider le lien d'accès
      const { data: accessLinkData, error } = await supabase
        .from('access_links')
        .select(`
          *,
          albums (*)
        `)
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error || !accessLinkData) {
        return res.status(404).json({ error: 'Access link not found or inactive' });
      }

      // Vérifier la validité avec la fonction SQL
      const { data: isValid, error: validationError } = await supabase
        .rpc('is_access_link_valid', { link_token: token });

      if (validationError || !isValid) {
        return res.status(403).json({
          error: 'Access link expired, reached usage limit, or invalid'
        });
      }

      // Incrémenter le compteur d'usage
      await supabase
        .from('access_links')
        .update({
          used_count: accessLinkData.used_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', accessLinkData.id);

      // Ajouter les données à la requête
      req.accessLink = new AccessLink(accessLinkData);
      req.album = new Album(accessLinkData.albums);

      next();

    } catch (error) {
      console.error('Access link validation error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Vérifier l'accès à une photo via son album
  async checkPhotoAccess(req, res, next) {
    try {
      const photoId = req.params.id || req.params.photoId;

      if (!photoId) {
        return res.status(400).json({ error: 'Photo ID required' });
      }

      const { data: photo, error } = await supabase
        .from('photos')
        .select(`
          *,
          albums (*)
        `)
        .eq('id', photoId)
        .single();

      if (error || !photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const album = photo.albums;

      // Vérifier l'accès : propriétaire ou album public
      const hasAccess = album.owner_id === req.user.id || album.is_public;

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this photo' });
      }

      req.photo = photo;
      req.album = album;

      next();

    } catch (error) {
      console.error('Photo access check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Middleware pour les routes admin uniquement
  requireAdmin(req, res, next) {
    const userRole = req.user.user_metadata?.role || 'user';

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    next();
  },

  // Vérifier si l'utilisateur peut voir les statistiques d'un album
  async checkAlbumStats(req, res, next) {
    try {
      const { albumId } = req.params;

      const album = await Album.findById(albumId);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      // Seul le propriétaire peut voir les stats
      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied to album statistics' });
      }

      req.album = album;
      next();

    } catch (error) {
      console.error('Album stats check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = authorization;