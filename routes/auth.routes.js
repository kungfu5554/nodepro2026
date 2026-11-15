// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Public endpoints
router.get('/departments', authController.getPublicDepartments);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/register', authController.register);

// Protected endpoints
router.get('/me', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;
