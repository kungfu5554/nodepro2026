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
router.put('/metrics/:id', requireRole('admin', 'hr'), hrController.updateMetric);
router.delete('/metrics/:id', requireRole('admin', 'hr'), hrController.deleteMetric);

// Assignment management
router.get('/assignments', requireRole('admin', 'hr'), hrController.getAssignments);
router.post('/assignments', requireRole('admin', 'hr'), hrController.createAssignment);
router.delete('/assignments/:id', requireRole('admin', 'hr'), hrController.deleteAssignment);

// Overview statistics
router.get('/statistics', requireRole('admin', 'hr'), hrController.getStatistics);

module.exports = router;
