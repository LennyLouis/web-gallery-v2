const express = require('express');
const router = express.Router();
const accessLinkController = require('../controllers/accessLinkController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

// Route publique pour validation de lien
router.get('/validate/:token', accessLinkController.validate);

// Routes protégées
router.use(authenticateToken);

// CRUD access links
router.post('/', validateRequest(schemas.createAccessLink), accessLinkController.create);
router.get('/', accessLinkController.getAll);
router.get('/album/:albumId', accessLinkController.getByAlbum);
router.get('/:id', accessLinkController.getById);
router.put('/:id', accessLinkController.update);
router.delete('/:id', accessLinkController.delete);
router.patch('/:id/deactivate', accessLinkController.deactivate);

module.exports = router;