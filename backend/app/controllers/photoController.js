const Photo = require('../models/Photo');
const Album = require('../models/Album');
const UserAlbumPermission = require('../models/UserAlbumPermission');
const { supabase, supabaseAdmin } = require('../config/database');
const s3Storage = require('../utils/s3Storage');
const archiver = require('archiver');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

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
      const { access_token } = req.query;

      // Si un token d'accès est fourni, l'utiliser pour la validation
      if (access_token) {
        const AccessLink = require('../models/AccessLink');
        const accessLink = await AccessLink.findByToken(access_token);
        
        if (!accessLink || !accessLink.is_active) {
          return res.status(401).json({ error: 'Invalid access token' });
        }

        if (accessLink.album_id !== albumId) {
          return res.status(403).json({ error: 'Access token not valid for this album' });
        }

        const photos = await Photo.findByAlbum(albumId);

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

        return res.json({ photos: photosWithUrls });
      }

      // Mode utilisateur authentifié normal
      const album = await Album.findById(albumId);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }

      const hasAccess = await UserAlbumPermission.hasPermission(req.user.id, albumId, 'view');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const photos = await Photo.findByAlbum(albumId);

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

      res.json({ photos: photosWithUrls });

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

      const hasAccess = await UserAlbumPermission.hasPermission(req.user.id, photo.album_id, 'view');
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

      if (photoIds.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 photos per download' });
      }
      
      const photos = await Promise.all(
        photoIds.map(async id => {
          try {
            return await Photo.findById(id);
          } catch (error) {
            console.warn(`Failed to fetch photo ${id}:`, error);
            return null;
          }
        })
      );

      const validPhotos = photos.filter(photo => photo !== null);

      if (validPhotos.length === 0) {
        return res.status(404).json({ error: 'No valid photos found' });
      }

      // Vérifier l'accès pour chaque photo
      const accessiblePhotos = [];

      for (const photo of validPhotos) {
        let hasAccess = false;
        
        if (req.accessLink) {
          // Mode access token : vérifier que la photo appartient à l'album du lien d'accès
          hasAccess = (photo.album_id === req.accessLink.album_id);
        } else if (req.user) {
          // Mode utilisateur authentifié : vérifier les permissions utilisateur
          hasAccess = await UserAlbumPermission.hasPermission(req.user.id, photo.album_id, 'download');
        }
        
        if (hasAccess) {
          accessiblePhotos.push(photo);
        }
      }

      if (accessiblePhotos.length === 0) {
        return res.status(403).json({ error: 'No accessible photos found' });
      }

      // Incrémenter le compteur de téléchargements pour chaque album concerné
      const albumIds = [...new Set(accessiblePhotos.map(photo => photo.album_id))];
      await Promise.all(
        albumIds.map(async (albumId) => {
          try {
            await Album.incrementDownloadCount(albumId);
            console.log(`📊 Incremented download count for album ${albumId}`);
          } catch (error) {
            console.warn(`Failed to increment download count for album ${albumId}:`, error);
          }
        })
      );

      // Si c'est une seule photo, faire un téléchargement direct
      if (accessiblePhotos.length === 1) {
        const photo = accessiblePhotos[0];
        
        try {
          // Obtenir le stream du fichier depuis S3
          const s3Key = s3Storage.getPhotoPath(photo.album_id, photo.filename);
          
          const command = new GetObjectCommand({
            Bucket: s3Storage.bucket,
            Key: s3Key
          });

          const response = await s3Storage.s3Client.send(command);
          
          // Définir les headers pour le téléchargement direct
          const originalName = photo.original_name || photo.filename;
          const extension = originalName.split('.').pop() || 'jpg';
          const filename = originalName.includes('.') ? originalName : `${originalName}.${extension}`;
          
          res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          if (response.ContentLength) {
            res.setHeader('Content-Length', response.ContentLength);
          }

          // Convertir le stream AWS SDK v3 en Node.js stream
          const { Readable } = require('stream');
          
          if (response.Body instanceof Readable) {
            // Si c'est déjà un stream Node.js
            response.Body.pipe(res);
          } else {
            // Pour AWS SDK v3, Body peut être un ReadableStream web
            const nodeStream = Readable.fromWeb(response.Body);
            nodeStream.pipe(res);
          }
          
          return;
          
        } catch (error) {
          console.error('Error downloading single photo:', error);
          // Fallback vers l'URL signée si le streaming direct échoue
          const downloadUrl = await photo.getDownloadUrl();
          return res.json({
            single_photo: true,
            download_url: downloadUrl,
            filename: photo.original_name || photo.filename
          });
        }
      }

      // Pour plusieurs photos, créer un ZIP
      console.log(`📦 Creating ZIP archive for ${accessiblePhotos.length} photos`);
      
      // Créer l'archive ZIP
      const archive = archiver('zip', {
        zlib: { level: 1 } // Compression rapide
      });

      // Gérer les erreurs de l'archive
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Archive creation failed' });
        }
      });

      archive.on('warning', (err) => {
        console.warn('Archive warning:', err);
      });

      // Définir les headers pour le téléchargement
      const albumTitle = accessiblePhotos[0]?.album_id ? 
        (await Album.findById(accessiblePhotos[0].album_id))?.title || 'Album' : 'Photos';
      const zipFilename = `${albumTitle.replace(/[^a-zA-Z0-9]/g, '_')}_photos.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      // Pipe l'archive vers la réponse
      archive.pipe(res);

      // Ajouter chaque photo à l'archive
      for (let i = 0; i < accessiblePhotos.length; i++) {
        const photo = accessiblePhotos[i];
        console.log(`📦 Processing photo ${i + 1}/${accessiblePhotos.length}: ${photo.filename}`);
        
        try {
          // Utiliser la même méthode que pour le téléchargement direct
          const s3Key = s3Storage.getPhotoPath(photo.album_id, photo.filename);
          console.log(`📦 S3 Key: ${s3Key}`);
          
          const command = new GetObjectCommand({
            Bucket: s3Storage.bucket,
            Key: s3Key,
          });

          const response = await s3Storage.s3Client.send(command);
          
          if (!response.Body) {
            console.error(`No file data returned for photo ${photo.id}`);
            continue;
          }

          console.log(`📦 Photo ${photo.filename} - Size: ${response.ContentLength} bytes`);

          // Convertir le stream AWS SDK v3 en Buffer
          const { Readable } = require('stream');
          let bodyStream;
          
          if (response.Body instanceof Readable) {
            bodyStream = response.Body;
          } else {
            // Pour AWS SDK v3, convertir le ReadableStream web en Node.js stream
            bodyStream = Readable.fromWeb(response.Body);
          }

          const chunks = [];
          for await (const chunk of bodyStream) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          
          console.log(`📦 Photo ${photo.filename} - Buffer size: ${buffer.length} bytes`);

          // Générer un nom de fichier unique pour éviter les conflits
          const fileExtension = photo.filename.split('.').pop();
          const baseName = photo.original_name || photo.filename.replace(/\.[^/.]+$/, "");
          const uniqueFilename = `${baseName}_${photo.id.substring(0, 8)}.${fileExtension}`;

          // Ajouter le fichier à l'archive
          archive.append(buffer, { name: uniqueFilename });
          console.log(`📦 Added ${uniqueFilename} to archive`);
          
        } catch (photoError) {
          console.error(`Error processing photo ${photo.id}:`, photoError);
          // Continuer avec les autres photos
        }
      }

      // Finaliser l'archive
      console.log(`📦 Finalizing archive...`);
      await archive.finalize();
      console.log(`📦 Archive finalized successfully`);

    } catch (error) {
      console.error('Download multiple photos error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Server error during download' });
      }
    }
  }
};

module.exports = photoController;