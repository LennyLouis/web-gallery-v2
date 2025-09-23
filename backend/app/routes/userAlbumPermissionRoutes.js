const express = require('express');
const router = express.Router();
const userAlbumPermissionController = require('../controllers/userAlbumPermissionController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: User Album Permissions
 *   description: User album permission management
 */

// All routes require authentication
router.use(authenticateToken);

// Validation schemas for permissions
const permissionSchemas = {
  grantPermission: {
    user_email: require('joi').string().email().required(),
    album_id: require('joi').string().uuid().required(),
    permission_type: require('joi').string().valid('view', 'download', 'manage').required(),
    expires_at: require('joi').date().optional()
  },

  revokePermission: {
    user_id: require('joi').string().uuid().required(),
    album_id: require('joi').string().uuid().required(),
    permission_type: require('joi').string().valid('view', 'download', 'manage').required()
  },

  updatePermission: {
    permission_type: require('joi').string().valid('view', 'download', 'manage').optional(),
    expires_at: require('joi').date().optional().allow(null),
    is_active: require('joi').boolean().optional()
  },

  inviteUser: {
    email: require('joi').string().email().required(),
    album_id: require('joi').string().uuid().required(),
    permission_type: require('joi').string().valid('view', 'download', 'manage').default('view'),
    expires_at: require('joi').date().optional()
  }
};

/**
 * @swagger
 * /api/permissions/grant:
 *   post:
 *     summary: Grant permission to user for album
 *     tags: [User Album Permissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_email:
 *                 type: string
 *                 format: email
 *               album_id:
 *                 type: string
 *                 format: uuid
 *               permission_type:
 *                 type: string
 *                 enum: [view, download, manage]
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Permission granted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: User or album not found
 */
router.post('/grant',
  validateRequest(require('joi').object(permissionSchemas.grantPermission)),
  userAlbumPermissionController.grantPermission
);

/**
 * @swagger
 * /api/permissions/revoke:
 *   post:
 *     summary: Revoke permission from user for album
 *     tags: [User Album Permissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *               album_id:
 *                 type: string
 *                 format: uuid
 *               permission_type:
 *                 type: string
 *                 enum: [view, download, manage]
 *     responses:
 *       200:
 *         description: Permission revoked successfully
 */
router.post('/revoke',
  validateRequest(require('joi').object(permissionSchemas.revokePermission)),
  userAlbumPermissionController.revokePermission
);

/**
 * @swagger
 * /api/permissions/invite:
 *   post:
 *     summary: Invite user by email and grant permission
 *     tags: [User Album Permissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               album_id:
 *                 type: string
 *                 format: uuid
 *               permission_type:
 *                 type: string
 *                 enum: [view, download, manage]
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: User invited successfully
 */
router.post('/invite',
  validateRequest(require('joi').object(permissionSchemas.inviteUser)),
  userAlbumPermissionController.inviteUser
);

/**
 * @swagger
 * /api/permissions/album/{albumId}:
 *   get:
 *     summary: Get all permissions for an album
 *     tags: [User Album Permissions]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of permissions for the album
 */
router.get('/album/:albumId', userAlbumPermissionController.getAlbumPermissions);

/**
 * @swagger
 * /api/permissions/user:
 *   get:
 *     summary: Get all permissions for current user
 *     tags: [User Album Permissions]
 *     responses:
 *       200:
 *         description: List of permissions for the user
 */
router.get('/user', userAlbumPermissionController.getUserPermissions);

/**
 * @swagger
 * /api/permissions/check/{albumId}:
 *   get:
 *     summary: Check if current user has permission on album
 *     tags: [User Album Permissions]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: permission
 *         schema:
 *           type: string
 *           enum: [view, download, manage]
 *           default: view
 *     responses:
 *       200:
 *         description: Permission check result
 */
router.get('/check/:albumId', userAlbumPermissionController.checkPermission);

/**
 * @swagger
 * /api/permissions/detailed/{albumId}:
 *   get:
 *     summary: Get detailed permissions for user on album
 *     tags: [User Album Permissions]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detailed permissions for the user on the album
 */
router.get('/detailed/:albumId', userAlbumPermissionController.getDetailedPermissions);

/**
 * @swagger
 * /api/permissions/{id}:
 *   put:
 *     summary: Update permission
 *     tags: [User Album Permissions]
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
 *               permission_type:
 *                 type: string
 *                 enum: [view, download, manage]
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *   delete:
 *     summary: Delete permission
 *     tags: [User Album Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Permission deleted successfully
 */
router.put('/:id',
  validateRequest(require('joi').object(permissionSchemas.updatePermission)),
  userAlbumPermissionController.updatePermission
);

router.delete('/:id', userAlbumPermissionController.deletePermission);

module.exports = router;