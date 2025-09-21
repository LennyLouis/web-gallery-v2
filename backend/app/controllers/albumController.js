const Album = require('../models/Album');
const Photo = require('../models/Photo');
const { supabase, supabaseAdmin } = require('../config/database');

const albumController = {
  async create(req, res) {
    try {
      const { title, description, date, tags, location, is_public } = req.body;
      const owner_id = req.user.id;

      const albumData = {
        title,
        description,
        date,
        tags: tags || [],
        location,
        is_public: is_public || false,
        owner_id
      };

      const album = await Album.create(albumData);

      res.status(201).json({
        message: 'Album created successfully',
        album
      });

    } catch (error) {
      console.error('Create album error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getAll(req, res) {
    try {
      const owner_id = req.user.id;
      const albums = await Album.findByOwner(owner_id);

      res.json({
        albums
      });

    } catch (error) {
      console.error('Get albums error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getPublic(req, res) {
    try {
      const albums = await Album.findPublic();

      res.json({
        albums
      });

    } catch (error) {
      console.error('Get public albums error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const album = await Album.findById(id);

      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      // Check if user has access to this album
      const hasAccess = album.owner_id === req.user.id || album.is_public;

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get photos for this album
      const photos = await album.getPhotos();

      res.json({
        album: {
          ...album,
          photos
        }
      });

    } catch (error) {
      console.error('Get album error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getByAccessLink(req, res) {
    try {
      const { token } = req.params;

      // Find and validate access link
      const { data: accessLink, error: linkError } = await supabaseAdmin
        .from('access_links')
        .select(`
          *,
          albums (*)
        `)
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (linkError || !accessLink) {
        return res.status(404).json({ error: 'Access link not found' });
      }

      // Check if link is valid (not expired, usage limits)
      const { data: isValid } = await supabaseAdmin
        .rpc('is_access_link_valid', { link_token: token });

      if (!isValid) {
        return res.status(403).json({ error: 'Access link expired or invalid' });
      }

      // Increment usage count
      await supabaseAdmin
        .from('access_links')
        .update({
          used_count: accessLink.used_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', accessLink.id);

      // Get album with photos (using admin client to bypass RLS)
      const album = new Album(accessLink.albums);
      const { data: photosData, error: photosError } = await supabaseAdmin
        .from('photos')
        .select('*')
        .eq('album_id', album.id)
        .order('created_at', { ascending: true });

      if (photosError) {
        throw photosError;
      }

      const photos = photosData.map(photo => new Photo(photo));

      res.json({
        album: {
          ...album,
          photos
        }
      });

    } catch (error) {
      console.error('Get album by access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description, date, tags, location, is_public } = req.body;

      const album = await Album.findById(id);

      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (date !== undefined) updates.date = date;
      if (tags !== undefined) updates.tags = tags;
      if (location !== undefined) updates.location = location;
      if (is_public !== undefined) updates.is_public = is_public;

      const updatedAlbum = await Album.update(id, updates);

      res.json({
        message: 'Album updated successfully',
        album: updatedAlbum
      });

    } catch (error) {
      console.error('Update album error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      const album = await Album.findById(id);

      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete all photos from storage
      const photos = await Photo.findByAlbum(id);

      for (const photo of photos) {
        // Delete from storage buckets
        await Promise.all([
          supabase.storage.from('photos').remove([photo.file_path]),
          supabase.storage.from('previews').remove([photo.preview_path])
        ]);
      }

      // Delete album (cascade will delete photos and access_links)
      await Album.delete(id);

      res.json({
        message: 'Album deleted successfully'
      });

    } catch (error) {
      console.error('Delete album error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = albumController;