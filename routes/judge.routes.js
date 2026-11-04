// routes/judge.routes.js
const express = require('express');
const router = express.Router();
const judgeController = require('../controllers/judge.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Judge routes
router.get('/assigned', requireRole('judge'), judgeController.getAssignedEvaluatees);
router.get('/grading/:assignmentId', requireRole('judge'), judgeController.getCandidateDetailsForGrading);
router.post('/submit/:assignmentId', requireRole('judge'), judgeController.submitEvaluation);

module.exports = router;

