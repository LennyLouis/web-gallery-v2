const AlbumExport = require('../models/AlbumExport');
const UserAlbumPermission = require('../models/UserAlbumPermission');
const Photo = require('../models/Photo');

const exportController = {
  async create(req, res) {
    try {
      const { albumId } = req.params;
      const { photoIds, all } = req.body || {};
      const userId = req.user.id;

      // Validate permission (download)
      const allowed = await UserAlbumPermission.hasPermission(userId, albumId, 'download');
      if (!allowed) return res.status(403).json({ error: 'Access denied' });

      // Get photos to include
      let photos;
      if (photoIds && photoIds.length > 0) {
        // Use provided photo IDs
        photos = await Promise.all(photoIds.map(id => Photo.findById(id)));
        photos = photos.filter(p => p && p.album_id === albumId);
      } else if (all) {
        // Export all photos from album
        photos = await Photo.findByAlbum(albumId);
      } else {
        return res.status(400).json({ error: 'Either photoIds or all=true must be specified' });
      }

      if (!photos.length) {
        return res.status(400).json({ error: 'No photos found for export' });
      }

      // Calculate total size
      const totalBytes = photos.reduce((sum, p) => sum + (p.file_size || 4 * 1024 * 1024), 0);

      // Create export job for runner
      const exportRow = await AlbumExport.createForRunner({
        albumId,
        photoIds: photos.map(p => p.id),
        userId,
        totalPhotos: photos.length,
        totalBytes
      });

      res.status(202).json({ 
        export: { 
          ...exportRow, 
          percent: 0 // Always starts at 0 for new exports
        } 
      });

    } catch (error) {
      console.error('Create export error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async status(req, res) {
    try {
      const { albumId, exportId } = req.params;
      const exportRow = await AlbumExport.findById(exportId);
      if (!exportRow || exportRow.album_id !== albumId) {
        return res.status(404).json({ error: 'Export not found' });
      }

      // Simple in-memory throttle (attach to app locals). Min interval 500ms per export ID.
      const THROTTLE_MS = parseInt(process.env.EXPORT_STATUS_MIN_INTERVAL_MS || '500', 10);
      if (!req.app.locals.__exportStatusLast) req.app.locals.__exportStatusLast = {};
      const last = req.app.locals.__exportStatusLast[exportId];
      const now = Date.now();
      if (last && (now - last) < THROTTLE_MS) {
        return res.status(429).json({ error: 'Too Many Requests', retry_after_ms: THROTTLE_MS - (now - last) });
      }
      req.app.locals.__exportStatusLast[exportId] = now;

      res.json({ export: { ...exportRow, percent: exportRow.percent } });
    } catch (error) {
      console.error('Status export error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async download(req, res) {
    try {
      const { albumId, exportId } = req.params;
      const exportRow = await AlbumExport.findById(exportId);
      
      if (!exportRow || exportRow.album_id !== albumId) {
        return res.status(404).json({ error: 'Export not found' });
      }

      if (exportRow.status !== 'ready') {
        return res.status(409).json({ 
          error: 'Export not ready', 
          status: exportRow.status,
          percent: exportRow.percent 
        });
      }

      // Check if download URL has expired
      if (!exportRow.download_url || (exportRow.expires_at && new Date() > new Date(exportRow.expires_at))) {
        return res.status(410).json({ 
          error: 'Download link has expired',
          status: 'expired'
        });
      }

      res.json({
        download_url: exportRow.download_url,
        checksum: exportRow.checksum,
        expires_at: exportRow.expires_at,
        total_photos: exportRow.total_photos,
        file_size: exportRow.processed_bytes
      });

    } catch (error) {
      console.error('Download export error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = exportController;
