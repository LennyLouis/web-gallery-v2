const Album = require('../models/Album');
const Photo = require('../models/Photo');
const UserAlbumPermission = require('../models/UserAlbumPermission');
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
      const user_id = req.user.id;
      console.log(`📁 [${new Date().toISOString()}] Getting albums for user: ${user_id}`);
      
      // Get albums owned by the user
      const ownedAlbums = await Album.findByOwner(user_id);
      console.log(`📁 Found ${ownedAlbums.length} owned albums:`, ownedAlbums.map(a => ({ id: a.id, title: a.title })));
      
      // Get albums user has permission to access
      const userPermissions = await UserAlbumPermission.findByUser(user_id);
      console.log(`🔐 Found ${userPermissions.length} permission records`);
      
      // Get the albums from permissions that are not already in owned albums
      const permissionAlbumIds = userPermissions.map(p => p.album_id);
      const permissionAlbums = [];
      
      for (const albumId of permissionAlbumIds) {
        // Skip if already owned
        if (ownedAlbums.find(album => album.id === albumId)) {
          continue;
        }
        
        try {
          const album = await Album.findById(albumId);
          if (album) {
            // Add permission info to album
            const userAlbumPermissions = userPermissions.filter(p => p.album_id === albumId);
            album.user_permissions = userAlbumPermissions.map(p => ({
              permission_type: p.permission_type,
              granted_at: p.granted_at,
              expires_at: p.expires_at,
              is_active: p.is_active
            }));
            permissionAlbums.push(album);
          }
        } catch (error) {
          console.error(`Error fetching album ${albumId}:`, error);
        }
      }
      
      // Combine owned and permitted albums
      const allAlbums = [...ownedAlbums, ...permissionAlbums];
      console.log(`📁 Returning ${allAlbums.length} total albums`);

      res.json({ albums: allAlbums });

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

      // Check if user has access to this album using advanced permissions
      const hasAccess = await UserAlbumPermission.hasPermission(req.user.id, id, 'view');

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get photos for this album
      const photos = await album.getPhotos();

      // Get user's detailed permissions for this album
      const userPermissions = await UserAlbumPermission.getUserAlbumPermissions(req.user.id, id);

      res.json({
        album: {
          ...album,
          photos
        },
        user_permissions: userPermissions
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

  async getAlbumUsers(req, res) {
    try {
      const { id } = req.params;
      // Vérifier que l'album existe
      const album = await Album.findById(id);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }
      // Récupérer les permissions utilisateurs pour cet album
      const permissions = await UserAlbumPermission.findByAlbum(id);
      // Formater la réponse
      const users = permissions.map(p => {
        const userInfo = p.user_info || {};
        const metaData = userInfo.raw_user_meta_data || {};
        
        return {
          id: userInfo.id || p.user_id,
          email: userInfo.email || 'unknown@email.com',
          name: metaData.full_name || metaData.name || userInfo.email?.split('@')[0] || 'Utilisateur',
          role: metaData.role || 'user',
          raw_user_meta_data: metaData,
          permission_type: p.permission_type,
          granted_at: p.granted_at,
          expires_at: p.expires_at,
          is_active: p.is_active
        };
      });
      res.json({ users });
    } catch (error) {
      console.error('Get album users error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description, date, tags, location, is_public, cover_photo_id } = req.body;

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
      if (cover_photo_id !== undefined) updates.cover_photo_id = cover_photo_id;

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

  async deleteAlbum(req, res) {
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
    },

  async setCoverPhoto(req, res) {
    try {
      const { id } = req.params;
      const { cover_photo_id } = req.body;

      const album = await Album.findById(id);

      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      if (album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Vérifier que la photo appartient à cet album si un ID est fourni
      if (cover_photo_id) {
        const photo = await Photo.findById(cover_photo_id);
        if (!photo || photo.album_id !== id) {
          return res.status(400).json({ error: 'Photo not found in this album' });
        }
      }

      const updatedAlbum = await Album.update(id, { cover_photo_id });

      res.json({
        message: 'Cover photo updated successfully',
        album: updatedAlbum
      });

    } catch (error) {
      console.error('Set cover photo error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = albumController;