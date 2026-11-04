// routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const hrRoutes = require('./hr.routes');
const evaluateeRoutes = require('./evaluatee.routes');
const judgeRoutes = require('./judge.routes');
const uploadRoutes = require('./upload.routes');

// Mount sub-routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/hr', hrRoutes);
router.use('/evaluatee', evaluateeRoutes);
router.use('/judge', judgeRoutes);
router.use('/upload', uploadRoutes);

module.exports = router;

