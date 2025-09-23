const express = require('express');
const router = express.Router();
const accessLinkController = require('../controllers/accessLinkController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: Access Links
 *   description: Secure album access link management
 */

/**
 * @swagger
 * /api/access-links/validate/{token}:
 *   get:
 *     summary: Validate access link token
 *     operationId: validateAccessLink
 *     tags: [Access Links]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Access link token
 *     responses:
 *       200:
 *         description: Valid access link
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 access_link:
 *                   $ref: '#/components/schemas/AccessLink'
 *                 album:
 *                   $ref: '#/components/schemas/Album'
 *       404:
 *         description: Access link not found
 *       403:
 *         description: Access link expired or invalid
 */
router.get('/validate/:token', accessLinkController.validate);

// Routes protégées
router.use(authenticateToken);

/**
 * @swagger
 * /api/access-links:
 *   post:
 *     summary: Create new access link
 *     tags: [Access Links]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAccessLink'
 *     responses:
 *       201:
 *         description: Access link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 access_link:
 *                   $ref: '#/components/schemas/AccessLink'
 *   get:
 *     summary: Get all user's access links
 *     tags: [Access Links]
 *     responses:
 *       200:
 *         description: List of access links
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_links:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AccessLink'
 */
router.post('/', validateRequest(schemas.createAccessLink), accessLinkController.create);
router.get('/', accessLinkController.getAll);

/**
 * @swagger
 * /api/access-links/album/{albumId}:
 *   get:
 *     summary: Get access links for specific album
 *     tags: [Access Links]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Access links for album
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_links:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AccessLink'
 */
router.get('/album/:albumId', accessLinkController.getByAlbum);

/**
 * @swagger
 * /api/access-links/{id}:
 *   get:
 *     summary: Get access link by ID
 *     tags: [Access Links]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Access link data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_link:
 *                   $ref: '#/components/schemas/AccessLink'
 *   put:
 *     summary: Update access link
 *     tags: [Access Links]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *               max_uses:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Access link updated successfully
 *   delete:
 *     summary: Delete access link
 *     tags: [Access Links]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Access link deleted successfully
 */
router.get('/:id', accessLinkController.getById);
router.put('/:id', accessLinkController.update);
router.delete('/:id', accessLinkController.delete);

/**
 * @swagger
 * /api/access-links/{id}/deactivate:
 *   patch:
 *     summary: Deactivate access link
 *     tags: [Access Links]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Access link deactivated successfully
 */
router.patch('/:id/deactivate', accessLinkController.deactivate);

module.exports = router;