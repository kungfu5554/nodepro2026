const router = require('express').Router();
const c = require('../controllers/user.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken, requireRole('admin', 'hr'));
router.get('/', c.getUsers);
router.get('/:citizenId', c.getUserByCitizenId);
router.post('/', c.createUser);
router.put('/:citizenId/reset-password', c.resetUserPassword);
router.put('/:citizenId', c.updateUser);
router.delete('/:citizenId', c.deleteUser);

module.exports = router;
