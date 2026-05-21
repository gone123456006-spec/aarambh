const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/me', protect, userController.getMe);

router.put(
  '/me',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim().isMobilePhone().withMessage('Must be a valid phone number'),
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
  upload.single('avatar'),
  userController.updateAvatar
);

router.get('/me/stats', protect, userController.getStats);

module.exports = router;
