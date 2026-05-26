const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadVideo, uploadPdf } = require('../middleware/upload');
const validate = require('../middleware/validate');

const router = express.Router();

// Apply admin protection middleware globally to all sub-routes
router.use(protect, adminOnly);

router.get('/dashboard', adminController.getDashboardStats);

router.get('/users', adminController.getUsers);

router.post(
  '/courses',
  [
    body('title').trim().notEmpty().withMessage('Course title is required'),
    body('level').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid level designation'),
    body('color').isArray().withMessage('Color must be an array of gradient hex strings'),
    body('lessons').optional().isArray().withMessage('Lessons must be an array of lesson items'),
  ],
  validate,
  adminController.createCourse
);

router.put(
  '/courses/:id',
  [
    body('title').optional().trim().notEmpty().withMessage('Course title cannot be empty'),
    body('color').optional().isArray().withMessage('Color must be an array'),
    body('lessons').optional().isArray().withMessage('Lessons must be an array'),
  ],
  validate,
  adminController.updateCourse
);

router.post(
  '/courses/:id/lessons',
  [
    body('title').trim().notEmpty().withMessage('Lesson title is required'),
    body('duration').notEmpty().withMessage('Duration is required'),
  ],
  validate,
  adminController.addLesson
);

router.delete('/courses/:id', adminController.deleteCourse);

router.post('/upload/video', uploadVideo.single('video'), adminController.uploadVideo);

router.post('/upload/pdf', uploadPdf.single('pdf'), adminController.uploadPdf);

router.get('/analytics', adminController.getAnalytics);

module.exports = router;
