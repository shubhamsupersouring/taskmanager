const express = require('express');
const AuthController = require('../../app/auth/auth.controller');

const router = express.Router();

// Dummy reference route for auth module
// Method: GET /api/v1/auth/health
router.get('/health', AuthController.healthCheck);

module.exports = router;