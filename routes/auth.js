const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/login', authController.showLogin);
router.post('/login', authController.handleLogin);

router.get('/forgot-password', authController.showForgotPassword);
router.post('/forgot-password', authController.handleForgotPassword);

router.get('/reset-password/:token', authController.showResetPassword);
router.post('/reset-password', authController.handleResetPassword);

router.post('/logout', authController.handleLogout);

module.exports = router;

