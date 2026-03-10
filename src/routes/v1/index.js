const express = require('express');
const authRoutes = require('./auth.routes');

const router = express.Router();

// API version 1 routes
router.use('/auth', authRoutes);

module.exports = router;