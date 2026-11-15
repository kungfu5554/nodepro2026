const router = require('express').Router();
const c = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/departments', c.getPublicDepartments);
router.post('/login', c.login);
router.post('/logout', c.logout);
router.post('/register', c.register);
router.get('/me', authenticateToken, c.getProfile);
router.put('/profile', authenticateToken, c.updateProfile);

module.exports = router;
