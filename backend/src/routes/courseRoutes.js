const express = require('express');
const { body } = require('express-validator');
const courseController = require('../controllers/courseController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', protect, courseController.getCourses);

router.get('/progress', protect, courseController.getProgress);

router.post(
  '/progress',
  protect,
  [
    body('lessonId').trim().notEmpty().withMessage('Lesson ID is required'),
    body('isCompleted').optional().isBoolean().withMessage('isCompleted must be a boolean value'),
  ],
  validate,
  courseController.updateProgress
);

router.get('/:id', protect, courseController.getCourseById);

module.exports = router;
