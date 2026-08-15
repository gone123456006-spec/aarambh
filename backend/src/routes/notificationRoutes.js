const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/inAppNotificationController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', protect, notificationController.getNotifications);
router.get('/unread-count', protect, notificationController.getUnreadCount);
router.post('/bootstrap', protect, notificationController.bootstrap);

router.post(
  '/events',
  protect,
  [body('event').trim().notEmpty().withMessage('event is required')],
  validate,
  notificationController.reportEvent
);

router.put('/read-all', protect, notificationController.markAllAsRead);
router.delete('/', protect, notificationController.deleteAllNotifications);
router.put('/:id/read', protect, notificationController.markAsRead);
router.delete('/:id', protect, notificationController.deleteNotification);

module.exports = router;
