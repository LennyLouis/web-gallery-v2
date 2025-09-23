const express = require('express');
const router = express.Router();
const albumController = require('../controllers/albumController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: Albums
 *   description: Photo album management
 */

/**
 * @swagger
 * /api/albums/public:
 *   get:
 *     summary: Get public albums
 *     operationId: getPublicAlbums
 *     tags: [Albums]
 *     security: []
 *     responses:
 *       200:
 *         description: List of public albums
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 albums:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Album'
 */
router.get('/public', albumController.getPublic);

/**
 * @swagger
 * /api/albums/access/{token}:
 *   get:
 *     summary: Get album by access token
 *     operationId: getAlbumByAccessToken
 *     tags: [Albums]
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
 *         description: Album data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 album:
 *                   $ref: '#/components/schemas/Album'
 *       404:
 *         description: Album not found or access denied
 */
router.get('/access/:token', albumController.getByAccessLink);

// Routes protégées
router.use(authenticateToken);

/**
 * @swagger
 * /api/albums:
 *   post:
 *     summary: Create new album
 *     operationId: createAlbum
 *     tags: [Albums]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAlbum'
 *     responses:
 *       201:
 *         description: Album created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 album:
 *                   $ref: '#/components/schemas/Album'
 *       400:
 *         description: Invalid input
 *   get:
 *     summary: Get user's albums
 *     operationId: getUserAlbums
 *     tags: [Albums]
 *     responses:
 *       200:
 *         description: List of user's albums
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 albums:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Album'
 */
router.post('/', validateRequest(schemas.createAlbum), albumController.create);
router.get('/', albumController.getAll);

/**
 * @swagger
 * /api/albums/stats:
 *   get:
 *     summary: Get album statistics (admin only)
 *     operationId: getAlbumStats
 *     tags: [Albums]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Album statistics and data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_albums:
 *                       type: integer
 *                     public_albums:
 *                       type: integer
 *                     private_albums:
 *                       type: integer
 *                     total_downloads:
 *                       type: integer
 *                     top_albums:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Album'
 *                 albums:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Album'
 *       403:
 *         description: Admin access required
 */
router.get('/stats', albumController.getStats);

/**
 * @swagger
 * /api/albums/{id}:
 *   get:
 *     summary: Get album by ID
 *     operationId: getAlbumById
 *     tags: [Albums]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Album data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 album:
 *                   $ref: '#/components/schemas/Album'
 *       404:
 *         description: Album not found
 *   put:
 *     summary: Update album
 *     operationId: updateAlbum
 *     tags: [Albums]
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
 *             $ref: '#/components/schemas/CreateAlbum'
 *     responses:
 *       200:
 *         description: Album updated successfully
 *       404:
 *         description: Album not found
 *   delete:
 *     summary: Delete album
 *     operationId: deleteAlbum
 *     tags: [Albums]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Album deleted successfully
 *       404:
 *         description: Album not found
 */
router.get('/:id', albumController.getById);

/**
 * @swagger
 * /api/albums/{id}/users:
 *   get:
 *     summary: Get users affiliated with an album
 *     operationId: getAlbumUsers
 *     tags: [Albums]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Album ID
 *     responses:
 *       200:
 *         description: List of users affiliated with the album
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       raw_user_meta_data:
 *                         type: object
 *                       permission_type:
 *                         type: string
 *                       granted_at:
 *                         type: string
 *                         format: date-time
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                       is_active:
 *                         type: boolean
 *       404:
 *         description: Album not found
 */
router.get('/:id/users', albumController.getAlbumUsers);
router.put('/:id', validateRequest(schemas.updateAlbum), albumController.update);

router.put('/:id/cover', albumController.setCoverPhoto);

router.delete('/:id', albumController.deleteAlbum);

module.exports = router;