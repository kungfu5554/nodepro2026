// routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Apply authentication to all user management routes
router.use(authenticateToken);

// Admin & HR can manage users
router.get('/', requireRole('admin', 'hr'), userController.getUsers);
router.get('/:citizenId', requireRole('admin', 'hr'), userController.getUserByCitizenId);
router.post('/', requireRole('admin', 'hr'), userController.createUser);
router.put('/:citizenId/reset-password', requireRole('admin', 'hr'), userController.resetUserPassword);
router.put('/:citizenId', requireRole('admin', 'hr'), userController.updateUser);
router.delete('/:citizenId', requireRole('admin', 'hr'), userController.deleteUser);

module.exports = router;
