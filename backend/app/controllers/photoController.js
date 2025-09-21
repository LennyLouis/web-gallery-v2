const Photo = require('../models/Photo');
const Album = require('../models/Album');
const { supabase, supabaseAdmin } = require('../config/database');

const photoController = {
  async upload(req, res) {
    try {
      if (!req.processedFiles || req.processedFiles.length === 0) {
        return res.status(400).json({ error: 'No files processed' });
      }

      const uploadedPhotos = [];
      const allErrors = [...(req.processingErrors || [])];

      // Sauvegarder chaque fichier en base
      for (const fileData of req.processedFiles) {
        try {
          const photo = await Photo.create(fileData);
          uploadedPhotos.push(photo);
        } catch (dbError) {
          console.error('Database save error:', dbError);
          allErrors.push({
            filename: fileData.original_name,
            error: 'Database save failed'
          });
        }
      }

      res.status(201).json({
        message: 'Files uploaded successfully',
        uploaded: uploadedPhotos.length,
        errors: allErrors.length,
        photos: uploadedPhotos,
        failed: allErrors
      });

    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getByAlbum(req, res) {
    try {
      const { albumId } = req.params;

      // Vérifier l'accès à l'album
      const album = await Album.findById(albumId);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      const hasAccess = album.owner_id === req.user.id || album.is_public;
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const photos = await Photo.findByAlbum(albumId);

      // Générer les URLs signées pour chaque photo
      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => {
          const [downloadUrl, previewUrl] = await Promise.all([
            photo.getDownloadUrl(),
            photo.getPreviewUrl()
          ]);

          return {
            ...photo,
            download_url: downloadUrl,
            preview_url: previewUrl
          };
        })
      );

      res.json({
        photos: photosWithUrls
      });

    } catch (error) {
      console.error('Get photos error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;

      const photo = await Photo.findById(id);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Vérifier l'accès via l'album
      const album = await Album.findById(photo.album_id);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      const hasAccess = album.owner_id === req.user.id || album.is_public;
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Générer les URLs signées
      const [downloadUrl, previewUrl] = await Promise.all([
        photo.getDownloadUrl(),
        photo.getPreviewUrl()
      ]);

      res.json({
        photo: {
          ...photo,
          download_url: downloadUrl,
          preview_url: previewUrl
        }
      });

    } catch (error) {
      console.error('Get photo error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getByAccessLink(req, res) {
    try {
      const { token, photoId } = req.params;

      // Vérifier le lien d'accès
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

      // Vérifier la validité du lien
      const { data: isValid } = await supabaseAdmin
        .rpc('is_access_link_valid', { link_token: token });

      if (!isValid) {
        return res.status(403).json({ error: 'Access link expired or invalid' });
      }

      // Récupérer la photo
      const photo = await Photo.findById(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Vérifier que la photo appartient à l'album du lien
      if (photo.album_id !== accessLink.album_id) {
        return res.status(403).json({ error: 'Photo not accessible via this link' });
      }

      // Générer les URLs signées
      const [downloadUrl, previewUrl] = await Promise.all([
        photo.getDownloadUrl(),
        photo.getPreviewUrl()
      ]);

      res.json({
        photo: {
          ...photo,
          download_url: downloadUrl,
          preview_url: previewUrl
        }
      });

    } catch (error) {
      console.error('Get photo by access link error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      const photo = await Photo.findById(id);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Vérifier que l'utilisateur possède l'album
      const album = await Album.findById(photo.album_id);
      if (!album || album.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Supprimer les fichiers du storage
      await Promise.all([
        supabase.storage.from('photos').remove([photo.file_path]),
        supabase.storage.from('previews').remove([photo.preview_path])
      ]);

      // Supprimer de la base de données
      await Photo.delete(id);

      res.json({
        message: 'Photo deleted successfully'
      });

    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async downloadMultiple(req, res) {
    try {
      const { photoIds } = req.body;

      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: 'Photo IDs array required' });
      }

      const photos = await Promise.all(
        photoIds.map(id => Photo.findById(id))
      );

      const validPhotos = photos.filter(photo => photo !== null);

      if (validPhotos.length === 0) {
        return res.status(404).json({ error: 'No valid photos found' });
      }

      // Vérifier l'accès pour chaque photo
      const accessiblePhotos = [];

      for (const photo of validPhotos) {
        const album = await Album.findById(photo.album_id);
        if (album && (album.owner_id === req.user.id || album.is_public)) {
          const downloadUrl = await photo.getDownloadUrl();
          accessiblePhotos.push({
            id: photo.id,
            filename: photo.filename,
            original_name: photo.original_name,
            download_url: downloadUrl
          });
        }
      }

      res.json({
        photos: accessiblePhotos
      });

    } catch (error) {
      console.error('Download multiple photos error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = photoController;