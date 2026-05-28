const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const sendOtpValidators = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .matches(/^[^\s@]+@gmail\.com$/i)
    .withMessage('Only Gmail accounts are supported'),
];

const sendOtpHandlers = [authLimiter, sendOtpValidators, validate, authController.sendOtp];

router.post('/send-otp', ...sendOtpHandlers);

router.post(
  '/verify-otp',
  [
    body('email')
      .isEmail()
      .withMessage('Must be a valid email address')
      .matches(/^[^\s@]+@gmail\.com$/i)
      .withMessage('Only Gmail accounts are supported'),
    body('code')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be exactly 6 characters')
      .isNumeric()
      .withMessage('OTP must consist of numbers only'),
  ],
  validate,
  authController.verifyOtp
);

router.post('/refresh-token', authController.refreshAccessToken);

router.post('/logout', authController.logout);

module.exports = router;
module.exports.sendOtpHandlers = sendOtpHandlers;
