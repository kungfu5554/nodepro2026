const router = require('express').Router();
const c = require('../controllers/judge.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);
router.get('/assigned', requireRole('judge'), c.getAssignedEvaluatees);
router.post('/claim', requireRole('judge'), c.claimCandidate);
router.delete('/claim/:assignmentId', requireRole('judge'), c.unclaimCandidate);
router.get('/grading/:assignmentId', requireRole('judge', 'admin', 'hr'), c.getCandidateDetailsForGrading);
router.post('/submit/:assignmentId', requireRole('judge'), c.submitEvaluation);

module.exports = router;
