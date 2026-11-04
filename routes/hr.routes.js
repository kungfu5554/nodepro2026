// routes/hr.routes.js
const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hr.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Period management
router.get('/period', hrController.getPeriod);
router.put('/period/:id', requireRole('admin', 'hr'), hrController.updatePeriod);

// Metrics management
router.get('/metrics', hrController.getMetrics);
router.post('/metrics', requireRole('admin', 'hr'), hrController.createMetric);
router.delete('/metrics/:id', requireRole('admin', 'hr'), hrController.deleteMetric);

// Assignment management
router.get('/assignments', hrController.getAssignments);
router.post('/assignments', requireRole('admin', 'hr'), hrController.createAssignment);

// Overview statistics
router.get('/statistics', requireRole('admin', 'hr'), hrController.getStatistics);

module.exports = router;

