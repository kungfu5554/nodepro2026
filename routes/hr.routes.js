// routes/hr.routes.js
const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hr.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Period management
router.get('/period', hrController.getPeriod);
router.get('/periods', hrController.getAllPeriods);
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

// Department management
router.get('/departments', hrController.getDepartments);
router.post('/departments', requireRole('admin', 'hr'), hrController.createDepartment);
router.delete('/departments/:id', requireRole('admin', 'hr'), hrController.deleteDepartment);

// Custom Department Approval / Rejection by HR
router.get('/department-requests', requireRole('admin', 'hr'), hrController.getDepartmentRequests);
router.post('/department-requests/:userId/approve', requireRole('admin', 'hr'), hrController.approveDepartmentRequest);
router.post('/department-requests/:userId/reject', requireRole('admin', 'hr'), hrController.rejectDepartmentRequest);

// Department Judges management
router.get('/department-judges', hrController.getDepartmentJudges);
router.post('/department-judges', requireRole('admin', 'hr'), hrController.assignDepartmentJudge);
router.delete('/department-judges/:id', requireRole('admin', 'hr'), hrController.removeDepartmentJudge);

module.exports = router;
