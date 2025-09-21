const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

// Public routes
router.post('/login', validateRequest(schemas.login), authController.login);
router.post('/refresh', authController.refreshToken);

// Admin only routes
router.post('/register',
  authenticateToken,
  requireRole('admin'),
  validateRequest(schemas.register),
  authController.register
);

// Protected routes
router.post('/logout', authenticateToken, authController.logout);
router.get('/profile', authenticateToken, authController.profile);

module.exports = router;