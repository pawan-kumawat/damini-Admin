const router = require('express').Router();
const authController = require('../controllers/authController');
const adminAuth = require('../middleware/adminAuth');

router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.get('/profile', adminAuth, authController.getProfile);
router.post('/change-password', adminAuth, authController.changePassword);

module.exports = router;
