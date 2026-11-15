const router = require('express').Router();
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/hr', require('./hr.routes'));
router.use('/evaluatee', require('./evaluatee.routes'));
router.use('/judge', require('./judge.routes'));
router.use('/upload', require('./upload.routes'));
module.exports = router;
