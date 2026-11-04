// routes/evaluatee.routes.js
const express = require('express');
const router = express.Router();
const evaluateeController = require('../controllers/evaluatee.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Candidate self-service routes
router.get('/sheet', requireRole('teacher'), evaluateeController.getMyEvaluationSheet);
router.post('/self-submit', requireRole('teacher'), evaluateeController.saveSelfEvaluations);
router.put('/profile', requireRole('teacher'), evaluateeController.updateProfile);

module.exports = router;

