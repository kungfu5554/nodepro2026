// routes/hr.routes.js
const express = require('express');
const router = express.Router();
const periodController = require('../controllers/period.controller');
const metricController = require('../controllers/metric.controller');
const departmentController = require('../controllers/department.controller');
const assignmentController = require('../controllers/assignment.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Period, statistics & detailed tracking
router.get('/period', periodController.getPeriod);
router.get('/periods', periodController.getAllPeriods);
router.put('/period/:id', requireRole('admin', 'hr'), periodController.updatePeriod);
router.get('/statistics', requireRole('admin', 'hr'), periodController.getStatistics);
router.get('/tracking-overview', requireRole('admin', 'hr'), periodController.getTrackingOverview);
router.get('/tracking-individual/:teacherCitizenId', requireRole('admin', 'hr'), periodController.getIndividualTrackingDetail);

// Metric categories & metrics
router.get('/metric-categories', metricController.getMetricCategories);
router.post('/metric-categories', requireRole('admin', 'hr'), metricController.createMetricCategory);
router.put('/metric-categories/:id', requireRole('admin', 'hr'), metricController.updateMetricCategory);
router.delete('/metric-categories/:id', requireRole('admin', 'hr'), metricController.deleteMetricCategory);
router.get('/metrics', metricController.getMetrics);
router.post('/metrics', requireRole('admin', 'hr'), metricController.createMetric);
router.put('/metrics/:id', requireRole('admin', 'hr'), metricController.updateMetric);
router.delete('/metrics/:id', requireRole('admin', 'hr'), metricController.deleteMetric);

// Assignments
router.get('/assignments', requireRole('admin', 'hr'), assignmentController.getAssignments);
router.post('/assignments', requireRole('admin', 'hr'), assignmentController.createAssignment);
router.delete('/assignments/:id', requireRole('admin', 'hr'), assignmentController.deleteAssignment);

// Departments & requests & department judges
router.get('/departments', departmentController.getDepartments);
router.post('/departments', requireRole('admin', 'hr'), departmentController.createDepartment);
router.delete('/departments/:id', requireRole('admin', 'hr'), departmentController.deleteDepartment);
router.get('/department-requests', requireRole('admin', 'hr'), departmentController.getDepartmentRequests);
router.post('/department-requests/:userId/approve', requireRole('admin', 'hr'), departmentController.approveDepartmentRequest);
router.post('/department-requests/:userId/reject', requireRole('admin', 'hr'), departmentController.rejectDepartmentRequest);
router.get('/department-judges', departmentController.getDepartmentJudges);
router.post('/department-judges', requireRole('admin', 'hr'), departmentController.assignDepartmentJudge);
router.delete('/department-judges/:id', requireRole('admin', 'hr'), departmentController.removeDepartmentJudge);

module.exports = router;
