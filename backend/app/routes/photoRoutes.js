const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const { authenticateToken } = require('../middleware/auth');
const { upload, processImages, checkAlbumAccess } = require('../middleware/upload');

// Routes publiques pour accès via lien
router.get('/access/:token/:photoId', photoController.getByAccessLink);

// Routes protégées
router.use(authenticateToken);

// Upload de photos
router.post('/upload/:albumId',
  checkAlbumAccess,
  upload,
  processImages,
  photoController.upload
);

// CRUD photos
router.get('/album/:albumId', photoController.getByAlbum);
router.get('/:id', photoController.getById);
router.delete('/:id', photoController.delete);

// Téléchargement multiple
router.post('/download', photoController.downloadMultiple);

module.exports = router;