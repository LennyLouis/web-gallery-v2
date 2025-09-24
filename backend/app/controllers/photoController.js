const Photo = require('../models/Photo');
const Album = require('../models/Album');
const AlbumExport = require('../models/AlbumExport');
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

      // OPTIMISATION: Vérifier l'accès par album au lieu de photo par photo
      const albumIds = [...new Set(validPhotos.map(photo => photo.album_id))];
      const accessibleAlbums = new Set();

      console.log(`🔐 Checking permissions for ${albumIds.length} albums instead of ${validPhotos.length} photos`);

      for (const albumId of albumIds) {
        let hasAccess = false;
        
        if (req.accessLink) {
          // Mode access token : vérifier que l'album correspond au lien d'accès
          hasAccess = (albumId === req.accessLink.album_id);
        } else if (req.user) {
          // Mode utilisateur authentifié : vérifier les permissions utilisateur
          hasAccess = await UserAlbumPermission.hasPermission(req.user.id, albumId, 'download');
          if (hasAccess) {
            console.log(`✅ PERMISSION GRANTED: User ${req.user.id} -> Album ${albumId} (download)`);
          }
        }
        
        if (hasAccess) {
          accessibleAlbums.add(albumId);
        }
      }

      // Filtrer les photos par albums accessibles
      const accessiblePhotos = validPhotos.filter(photo => accessibleAlbums.has(photo.album_id));

      if (accessiblePhotos.length === 0) {
        return res.status(403).json({ error: 'No accessible photos found' });
      }

      console.log(`📊 Access check: ${accessiblePhotos.length}/${validPhotos.length} photos accessible`);

      // Test de connectivité S3 sur la première photo
      if (accessiblePhotos.length > 0) {
        try {
          const testPhoto = accessiblePhotos[0];
          const testS3Key = s3Storage.getPhotoPath(testPhoto.album_id, testPhoto.filename);
          console.log(`🧪 Testing S3 connectivity with: ${testS3Key}`);
          
          const { HeadObjectCommand } = require('@aws-sdk/client-s3');
          const headCommand = new HeadObjectCommand({ 
            Bucket: s3Storage.bucket, 
            Key: testS3Key 
          });
          
          const headResponse = await s3Storage.s3Client.send(headCommand);
          console.log(`✅ S3 connectivity OK - Size: ${headResponse.ContentLength} bytes, Type: ${headResponse.ContentType}`);
        } catch (s3Error) {
          console.error(`❌ S3 connectivity test failed:`, s3Error.message);
          return res.status(500).json({ 
            error: 'Storage connectivity issue', 
            details: s3Error.message 
          });
        }
      }

      // Incrémenter le compteur de téléchargements pour chaque album accessible
      await Promise.all(
        Array.from(accessibleAlbums).map(async (albumId) => {
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

      // Pour plusieurs photos, si la sélection dépasse un seuil configurable, lancer un export async
      const DIRECT_ZIP_MAX = parseInt(process.env.DIRECT_ZIP_MAX_PHOTOS || '10', 10); // Réduit de 30 à 10
      const MAX_MEMORY_MB = parseInt(process.env.DIRECT_ZIP_MAX_MEMORY_MB || '500', 10); // 500MB max en mémoire
      
      // Estimer la taille totale (approximation : 4MB par photo en moyenne)
      const estimatedSizeMB = accessiblePhotos.length * 4;
      
      if (accessiblePhotos.length > DIRECT_ZIP_MAX || estimatedSizeMB > MAX_MEMORY_MB) {
        console.log(`📊 Large download detected: ${accessiblePhotos.length} photos (~${estimatedSizeMB}MB) - Using async export`);
        
        // Utiliser la nouvelle architecture avec runner séparé
        try {
          // Regrouper par album? Simplification: supposons toutes du même album pour un ZIP direct; sinon on refuse
          const involvedAlbumIds = [...new Set(accessiblePhotos.map(p => p.album_id))];
          if (involvedAlbumIds.length > 1) {
            return res.status(400).json({ error: 'Async export currently supports photos from a single album at a time' });
          }
          
          const albumId = involvedAlbumIds[0];
          
          // Calculer la taille estimée
          const estimatedTotalBytes = accessiblePhotos.reduce((sum, photo) => sum + (photo.file_size || 4 * 1024 * 1024), 0);
          
          const exportRow = await AlbumExport.createForRunner({ 
            albumId, 
            photoIds: accessiblePhotos.map(p => p.id), 
            userId: req.user?.id,
            totalPhotos: accessiblePhotos.length,
            totalBytes: estimatedTotalBytes
          });
          
          return res.status(202).json({
            mode: 'async',
            message: 'Export job created - processing by runner service',
            export: { 
              id: exportRow.id, 
              status: exportRow.status, 
              percent: 0,
              album_id: exportRow.album_id,
              total_photos: exportRow.total_photos,
              total_bytes: exportRow.total_bytes
            }
          });
          
        } catch (e) {
          console.error('Runner-based export creation failed:', e.message);
          
          return res.status(500).json({
            error: 'Failed to create export job',
            details: e.message
          });
        }
      }

      // Pour plusieurs photos (petit volume), créer un ZIP direct
      console.log(`📦 Creating ZIP archive for ${accessiblePhotos.length} photos`);
      
      // Créer l'archive ZIP
      const archive = archiver('zip', {
        zlib: { level: 1 } // Compression rapide
      });

      // Gérer les erreurs de l'archive
      archive.on('error', (err) => {
        console.error('❌ Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Archive creation failed' });
        }
      });

      archive.on('warning', (err) => {
        console.warn('⚠️ Archive warning:', err);
      });

      archive.on('progress', (progress) => {
        console.log(`📦 Archive progress: ${progress.entries.processed}/${progress.entries.total} entries`);
      });

      archive.on('entry', (entry) => {
        console.log(`📁 Added to archive: ${entry.name} (${entry.stats.size} bytes)`);
      });

      // Définir les headers pour le téléchargement
      const albumTitle = accessiblePhotos[0]?.album_id ? 
        (await Album.findById(accessiblePhotos[0].album_id))?.title || 'Album' : 'Photos';
      const zipFilename = `${albumTitle.replace(/[^a-zA-Z0-9]/g, '_')}_photos.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      // Pipe l'archive vers la réponse
      archive.pipe(res);

      // Ajouter chaque photo à l'archive de manière séquentielle
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < accessiblePhotos.length; i++) {
        const photo = accessiblePhotos[i];
        console.log(`📦 Processing photo ${i + 1}/${accessiblePhotos.length}: ${photo.filename}`);
        
        try {
          const s3Key = s3Storage.getPhotoPath(photo.album_id, photo.filename);
          console.log(`🔑 S3 Key: ${s3Key}`);
          
          const command = new GetObjectCommand({ 
            Bucket: s3Storage.bucket, 
            Key: s3Key 
          });
          
          console.log(`⬇️ Downloading from S3: ${s3Key}`);
          const response = await s3Storage.s3Client.send(command);
          
          if (!response.Body) {
            throw new Error('No response body from S3');
          }
          
          console.log(`📊 Content Length: ${response.ContentLength} bytes, Content Type: ${response.ContentType}`);
          
          // Au lieu d'utiliser des streams, lire tout le contenu en mémoire pour éviter la corruption
          const chunks = [];
          const { Readable } = require('stream');
          
          let bodyStream = response.Body;
          if (!(bodyStream instanceof Readable)) {
            console.log('🔄 Converting Web Stream to Node Stream');
            bodyStream = Readable.fromWeb(response.Body);
          }
          
          // Lire tout le stream en mémoire
          await new Promise((resolve, reject) => {
            let totalBytes = 0;
            
            bodyStream.on('data', (chunk) => {
              chunks.push(chunk);
              totalBytes += chunk.length;
            });
            
            bodyStream.on('end', () => {
              console.log(`📥 Downloaded ${totalBytes} bytes for ${photo.filename}`);
              resolve();
            });
            
            bodyStream.on('error', (err) => {
              console.error(`❌ Stream error for ${photo.filename}:`, err);
              reject(err);
            });
            
            // Timeout de sécurité
            setTimeout(() => {
              reject(new Error(`Timeout downloading ${photo.filename}`));
            }, 30000);
          });
          
          // Combiner tous les chunks
          const completeBuffer = Buffer.concat(chunks);
          console.log(`🔗 Combined buffer size: ${completeBuffer.length} bytes`);
          
          const fileExtension = photo.filename.split('.').pop();
          const baseName = (photo.original_name || photo.filename).replace(/\.[^/.]+$/, '');
          const uniqueFilename = `${baseName}_${photo.id.substring(0,8)}.${fileExtension}`;
          
          console.log(`📁 Adding to archive as: ${uniqueFilename} (${completeBuffer.length} bytes)`);
          
          // Ajouter le buffer à l'archive (plus fiable que les streams)
          archive.append(completeBuffer, { 
            name: uniqueFilename
          });
          
          successCount++;
          console.log(`✅ Successfully added: ${uniqueFilename}`);
          
        } catch (err) {
          errorCount++;
          console.error(`❌ Failed to process ${photo.id} (${photo.filename}):`, err.message);
          
          // Ajouter un fichier d'erreur au ZIP pour indiquer le problème
          const errorContent = `Error downloading ${photo.filename}: ${err.message}`;
          archive.append(errorContent, { name: `ERROR_${photo.filename}.txt` });
        }
      }

      console.log(`📊 Archive processing complete: ${successCount} success, ${errorCount} errors`);

      // Finaliser l'archive
      console.log(`📦 Finalizing archive...`);
      
      const finalizePromise = new Promise((resolve, reject) => {
        archive.on('end', () => {
          console.log(`✅ Archive finalized successfully - Total bytes: ${archive.pointer()}`);
          resolve();
        });
        
        archive.on('error', (err) => {
          console.error(`❌ Archive finalization error:`, err);
          reject(err);
        });
        
        // Timeout de sécurité
        setTimeout(() => {
          reject(new Error('Archive finalization timeout'));
        }, 60000); // 1 minute
      });
      
      archive.finalize();
      await finalizePromise;

    } catch (error) {
      console.error('Download multiple photos error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Server error during download' });
      }
    }
  }
};

module.exports = photoController;