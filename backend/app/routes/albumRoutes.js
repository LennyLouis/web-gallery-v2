const express = require('express');
const router = express.Router();
const albumController = require('../controllers/albumController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

// Routes publiques
router.get('/public', albumController.getPublic);
router.get('/access/:token', albumController.getByAccessLink);

// Routes protégées
router.use(authenticateToken);

// CRUD albums
router.post('/', validateRequest(schemas.createAlbum), albumController.create);
router.get('/', albumController.getAll);
router.get('/:id', albumController.getById);
router.put('/:id', validateRequest(schemas.updateAlbum), albumController.update);
router.delete('/:id', albumController.delete);

module.exports = router;