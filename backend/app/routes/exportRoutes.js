const express = require('express');
const router = express.Router({ mergeParams: true });
const exportController = require('../controllers/exportController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     AlbumExport:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         album_id: { type: string, format: uuid }
 *         status: { type: string, enum: [queued, processing, ready, failed, cancelling, cancelled] }
 *         object_key: { type: string }
 *         total_photos: { type: integer }
 *         processed_photos: { type: integer }
 *         total_bytes: { type: integer }
 *         processed_bytes: { type: integer }
 *         percent: { type: integer }
 *         eta_seconds: { type: integer, nullable: true }
 *         checksum: { type: string, nullable: true }
 *         error: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         started_at: { type: string, format: date-time, nullable: true }
 *         completed_at: { type: string, format: date-time, nullable: true }
 *
 * /albums/{albumId}/exports:
 *   post:
 *     summary: Create (or reuse) an asynchronous ZIP export for an album
 *     security: [{ BearerAuth: [] }]
 *     tags: [Exports]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               photoIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               all:
 *                 type: boolean
 *     responses:
 *       202:
 *         description: Export queued or existing one returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 export:
 *                   $ref: '#/components/schemas/AlbumExport'
 *       400:
 *         description: Bad request
 *       403:
 *         description: Permission denied
 *
 * /albums/{albumId}/exports/{exportId}/status:
 *   get:
 *     summary: Get status of an album export
 *     security: [{ BearerAuth: [] }]
 *     tags: [Exports]
 *     responses:
 *       200:
 *         description: Status info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 export:
 *                   $ref: '#/components/schemas/AlbumExport'
 *       404: { description: Not found }
 *
 * /albums/{albumId}/exports/{exportId}/download:
 *   get:
 *     summary: Get a signed URL to download a ready export
 *     security: [{ BearerAuth: [] }]
 *     tags: [Exports]
 *     responses:
 *       200:
 *         description: Signed URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 download_url: { type: string }
 *                 checksum: { type: string }
 *       404: { description: Not found }
 *       409: { description: Not ready }
 */
router.post('/', authenticateToken, exportController.create);
router.get('/:exportId/status', authenticateToken, exportController.status);
router.get('/:exportId/download', authenticateToken, exportController.download);

module.exports = router;
