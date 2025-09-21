const AccessLink = require('../models/AccessLink');
const Album = require('../models/Album');
const { supabase } = require('../config/database');

const accessLinkController = {
  async create(req, res) {
    try {
      const { album_id, expires_at, max_uses } = req.body;

      // Vérifier que l'album existe et appartient à l'utilisateur
      const album = await Album.findById(album_id);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const linkData = {
        album_id,
        created_by: req.user.id,
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        max_uses: max_uses || null
      };

      const accessLink = await AccessLink.create(linkData);

      res.status(201).json({
        message: 'Access link created successfully',
        access_link: {
          ...accessLink,
          album_title: album.title
        }
      });

    } catch (error) {
      console.error('Create access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getByAlbum(req, res) {
    try {
      const { albumId } = req.params;

      // Vérifier que l'album appartient à l'utilisateur
      const album = await Album.findById(albumId);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const accessLinks = await AccessLink.findByAlbum(albumId);

      res.json({
        access_links: accessLinks.map(link => ({
          ...link,
          album_title: album.title,
          is_valid: link.isValid()
        }))
      });

    } catch (error) {
      console.error('Get access links error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getAll(req, res) {
    try {
      // Récupérer tous les liens d'accès de l'utilisateur
      const { data: accessLinks, error } = await supabase
        .from('access_links')
        .select(`
          *,
          albums (
            id,
            title,
            owner_id
          )
        `)
        .eq('created_by', req.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formattedLinks = accessLinks.map(link => ({
        ...link,
        album_title: link.albums.title,
        is_valid: new AccessLink(link).isValid()
      }));

      res.json({
        access_links: formattedLinks
      });

    } catch (error) {
      console.error('Get all access links error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;

      const { data: accessLink, error } = await supabase
        .from('access_links')
        .select(`
          *,
          albums (
            id,
            title,
            owner_id
          )
        `)
        .eq('id', id)
        .single();

      if (error || !accessLink) {
        return res.status(404).json({ error: 'Access link not found' });
      }

      // Vérifier que l'utilisateur a créé ce lien
      if (accessLink.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const link = new AccessLink(accessLink);

      res.json({
        access_link: {
          ...link,
          album_title: accessLink.albums.title,
          is_valid: link.isValid()
        }
      });

    } catch (error) {
      console.error('Get access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async validate(req, res) {
    try {
      const { token } = req.params;

      const accessLink = await AccessLink.findByToken(token);

      if (!accessLink) {
        return res.status(404).json({
          valid: false,
          error: 'Access link not found'
        });
      }

      const isValid = accessLink.isValid();

      if (!isValid) {
        return res.status(403).json({
          valid: false,
          error: 'Access link expired or reached usage limit'
        });
      }

      // Récupérer les informations de l'album
      const album = await accessLink.getAlbum();

      res.json({
        valid: true,
        access_link: {
          id: accessLink.id,
          token: accessLink.token,
          album_id: accessLink.album_id,
          expires_at: accessLink.expires_at,
          used_count: accessLink.used_count,
          max_uses: accessLink.max_uses
        },
        album: {
          id: album.id,
          title: album.title,
          description: album.description,
          date: album.date,
          location: album.location
        }
      });

    } catch (error) {
      console.error('Validate access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { expires_at, max_uses, is_active } = req.body;

      const accessLink = await AccessLink.findById ? await AccessLink.findById(id) : null;

      // Fallback: query directement
      if (!accessLink) {
        const { data, error } = await supabase
          .from('access_links')
          .select('*, albums(owner_id)')
          .eq('id', id)
          .single();

        if (error || !data) {
          return res.status(404).json({ error: 'Access link not found' });
        }

        // Vérifier les permissions
        if (data.albums.owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        // Vérifier via l'album
        const album = await accessLink.getAlbum();
        if (album.owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const updates = {};
      if (expires_at !== undefined) {
        updates.expires_at = expires_at ? new Date(expires_at).toISOString() : null;
      }
      if (max_uses !== undefined) updates.max_uses = max_uses;
      if (is_active !== undefined) updates.is_active = is_active;

      const updatedLink = await AccessLink.update(id, updates);

      res.json({
        message: 'Access link updated successfully',
        access_link: updatedLink
      });

    } catch (error) {
      console.error('Update access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      // Récupérer le lien et vérifier les permissions
      const { data: accessLink, error } = await supabase
        .from('access_links')
        .select(`
          *,
          albums (
            owner_id
          )
        `)
        .eq('id', id)
        .single();

      if (error || !accessLink) {
        return res.status(404).json({ error: 'Access link not found' });
      }

      if (accessLink.albums.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Supprimer le lien d'accès
      const { error: deleteError } = await supabase
        .from('access_links')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      res.json({
        message: 'Access link deleted successfully'
      });

    } catch (error) {
      console.error('Delete access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async deactivate(req, res) {
    try {
      const { id } = req.params;

      const updatedLink = await AccessLink.deactivate(id);

      res.json({
        message: 'Access link deactivated successfully',
        access_link: updatedLink
      });

    } catch (error) {
      console.error('Deactivate access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = accessLinkController;