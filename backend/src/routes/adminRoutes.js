const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const gameQuestionController = require('../controllers/gameQuestionController');
const adminNotificationController = require('../controllers/adminNotificationController');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadVideo, uploadPdf } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/login',
  authLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  adminController.adminLogin
);

router.use(protect, adminOnly);

router.get('/dashboard', adminController.getDashboardStats);

router.get('/users', adminController.getUsers);

router.get('/users/:id', adminController.getUserById);

router.get('/courses', adminController.getAdminCourses);

router.post(
  '/courses',
  [
    body('title').trim().notEmpty().withMessage('Course title is required'),
    body('level').optional().trim().notEmpty().withMessage('Level cannot be empty'),
    body('color').optional().isArray().withMessage('Color must be an array of gradient hex strings'),
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
  '/courses/:id/lessons/upsert',
  [body('title').trim().notEmpty().withMessage('Lesson title is required')],
  validate,
  adminController.upsertLesson
);

router.put(
  '/courses/:courseId/lessons/:lessonId',
  [body('title').optional().trim().notEmpty().withMessage('Lesson title cannot be empty')],
  validate,
  adminController.updateLesson
);

router.post(
  '/courses/:id/lessons',
  [body('title').trim().notEmpty().withMessage('Lesson title is required')],
  validate,
  adminController.addLesson
);

router.delete('/courses/:courseId/lessons/:lessonId', adminController.deleteLesson);

router.delete('/courses/:id', adminController.deleteCourse);

// Delete a single lesson's media (video or pdf) from a course
router.delete(
  '/courses/:courseId/lessons/:lessonId/media',
  adminController.deleteLessonMedia
);

router.post('/upload/video', uploadVideo.single('video'), adminController.uploadVideo);

router.post('/upload/pdf', uploadPdf.single('pdf'), adminController.uploadPdf);

router.get('/analytics', adminController.getAnalytics);

// Subscription management
router.get('/subscriptions', adminController.getSubscriptions);
router.get('/subscriptions/:id', adminController.getSubscriptionById);
router.put(
  '/subscriptions/:id/status',
  [body('status').isIn(['active', 'expired', 'cancelled', 'pending']).withMessage('Invalid status')],
  validate,
  adminController.updateSubscriptionStatus
);

// Game question management
router.get('/games/:gameId/questions', gameQuestionController.getGameQuestions);
router.get('/games/:gameId/questions/stats', gameQuestionController.getQuestionStats);
router.post(
  '/games/:gameId/questions',
  [
    body('level').isInt({ min: 1 }).withMessage('Level must be a positive integer'),
    body('difficulty')
      .optional()
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Difficulty must be easy, medium, or hard'),
  ],
  validate,
  gameQuestionController.createGameQuestion
);
router.put('/games/:gameId/questions/:questionId', gameQuestionController.updateGameQuestion);
router.delete('/games/:gameId/questions/:questionId', gameQuestionController.deleteGameQuestion);
router.post(
  '/games/:gameId/questions/bulk',
  [body('questions').isArray({ min: 1 }).withMessage('Questions array is required')],
  validate,
  gameQuestionController.bulkCreateQuestions
);

// Game level configuration
router.get('/games/:gameId/levels', gameQuestionController.getGameLevelConfig);
router.put(
  '/games/:gameId/levels',
  [
    body('maxLevel').optional().isInt({ min: 1 }).withMessage('Max level must be at least 1'),
    body('pointsPerCorrect').optional().isInt({ min: 0 }).withMessage('Points must be non-negative'),
  ],
  validate,
  gameQuestionController.updateGameLevelConfig
);

// Admin notification management
router.get('/notifications', adminNotificationController.getAdminNotifications);
router.get('/notifications/:id', adminNotificationController.getAdminNotificationById);
router.post(
  '/notifications',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('targetAudience')
      .optional()
      .isIn(['all', 'region', 'level', 'active', 'custom'])
      .withMessage('Invalid target audience'),
  ],
  validate,
  adminNotificationController.createAdminNotification
);
router.put(
  '/notifications/:id',
  [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('message').optional().trim().notEmpty().withMessage('Message cannot be empty'),
  ],
  validate,
  adminNotificationController.updateAdminNotification
);
router.delete('/notifications/:id', adminNotificationController.deleteAdminNotification);
router.post('/notifications/:id/send', adminNotificationController.sendAdminNotification);
router.post('/notifications/:id/cancel', adminNotificationController.cancelAdminNotification);
router.post('/notifications/preview-targets', adminNotificationController.previewNotificationTargets);

module.exports = router;
