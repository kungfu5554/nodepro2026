const router = require('express').Router();
const c = require('../controllers/evaluatee.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken, requireRole('teacher'));
router.get('/sheet', c.getMyEvaluationSheet);
router.post('/self-submit', c.saveSelfEvaluations);
router.put('/profile', c.updateProfile);

module.exports = router;
