const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const { authenticateToken, authenticateTokenOrAccessToken, requirePermission } = require('../middleware/auth');
const { upload, processImages, checkAlbumAccess } = require('../middleware/upload');

// Routes publiques pour accès via lien
router.get('/access/:token/:photoId', photoController.getByAccessLink);

// Route qui accepte les tokens d'authentification OU les tokens d'accès (permission 'view' required)
router.get('/album/:albumId', authenticateTokenOrAccessToken, requirePermission('view'), photoController.getByAlbum);

// Téléchargement multiple (permission 'download' required)
router.post('/download', authenticateTokenOrAccessToken, requirePermission('download'), photoController.downloadMultiple);

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
router.get('/:id', photoController.getById);
router.delete('/:id', photoController.delete);

module.exports = router;