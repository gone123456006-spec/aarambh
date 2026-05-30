const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/me', protect, userController.getMe);

router.put(
  '/me',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone')
      .optional()
      .trim()
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Must be a valid 10-digit Indian mobile number'),
    body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender value'),
    body('region').optional().trim().notEmpty().withMessage('Region cannot be empty'),
    body('level')
      .optional()
      .isIn(['starting', 'beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid english proficiency level'),
    body('referralCode').optional().trim(),
  ],
  validate,
  userController.updateProfile
);

router.put(
  '/avatar',
  protect,
  uploadAvatar.single('avatar'),
  userController.updateAvatar
);

router.get('/me/stats', protect, userController.getStats);

router.delete('/me', protect, userController.deleteMe);

module.exports = router;
