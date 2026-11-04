// routes/judge.routes.js
const express = require('express');
const router = express.Router();
const judgeController = require('../controllers/judge.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Judge routes (grading details also accessible to admin & hr for official PDF reports)
router.get('/assigned', requireRole('judge'), judgeController.getAssignedEvaluatees);
router.post('/init-assignment', requireRole('judge'), judgeController.initCandidateAssignment);
router.get('/grading/:assignmentId', requireRole('judge', 'admin', 'hr'), judgeController.getCandidateDetailsForGrading);
router.post('/submit/:assignmentId', requireRole('judge'), judgeController.submitEvaluation);

module.exports = router;
