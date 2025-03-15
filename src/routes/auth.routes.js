const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateRegister, validateLogin, validateChangePassword } = require('../middlewares/validation.middleware');

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authController.logout);
router.post('/verifyOtp', authController.VerifyOTP);
router.post('/sendOtp', authController.sendOtp);

// Protected routes (require authentication)
router.get('/profile', authMiddleware.verifyToken, authController.getProfile);
router.post(
    '/change-password',
    [authMiddleware.verifyToken, validateChangePassword],
    authController.changePassword
);

module.exports = router;