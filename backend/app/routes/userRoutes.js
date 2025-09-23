const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Get all users (admin only)
router.get('/', userController.getUsers);

// Get current user profile
router.get('/profile', userController.getProfile);

// Get user by ID
router.get('/:id', userController.getUserById);

module.exports = router;