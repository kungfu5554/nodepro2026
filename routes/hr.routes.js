const router = require('express').Router();
const p = require('../controllers/period.controller');
const m = require('../controllers/metric.controller');
const d = require('../controllers/department.controller');
const a = require('../controllers/assignment.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const hrOnly = requireRole('admin', 'hr');
router.use(authenticateToken);

router.get('/period', p.getPeriod);
router.get('/periods', p.getAllPeriods);
router.put('/period/:id', hrOnly, p.updatePeriod);
router.get('/statistics', hrOnly, p.getStatistics);
router.get('/tracking-overview', hrOnly, p.getTrackingOverview);
router.get('/tracking-individual/:teacherCitizenId', hrOnly, p.getIndividualTrackingDetail);

router.get('/metric-categories', m.getMetricCategories);
router.post('/metric-categories', hrOnly, m.createMetricCategory);
router.put('/metric-categories/:id', hrOnly, m.updateMetricCategory);
router.delete('/metric-categories/:id', hrOnly, m.deleteMetricCategory);
router.get('/metrics', m.getMetrics);
router.post('/metrics', hrOnly, m.createMetric);
router.put('/metrics/:id', hrOnly, m.updateMetric);
router.delete('/metrics/:id', hrOnly, m.deleteMetric);

router.get('/assignments', hrOnly, a.getAssignments);
router.post('/assignments', hrOnly, a.createAssignment);
router.delete('/assignments/:id', hrOnly, a.deleteAssignment);

router.get('/departments', d.getDepartments);
router.post('/departments', hrOnly, d.createDepartment);
router.delete('/departments/:id', hrOnly, d.deleteDepartment);
router.get('/department-requests', hrOnly, d.getDepartmentRequests);
router.post('/department-requests/:userId/approve', hrOnly, d.approveDepartmentRequest);
router.post('/department-requests/:userId/reject', hrOnly, d.rejectDepartmentRequest);
router.get('/department-judges', d.getDepartmentJudges);
router.post('/department-judges', hrOnly, d.assignDepartmentJudge);
router.delete('/department-judges/:id', hrOnly, d.removeDepartmentJudge);

module.exports = router;
