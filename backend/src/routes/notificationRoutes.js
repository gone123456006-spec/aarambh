const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, notificationController.getNotifications);

router.put('/:id/read', protect, notificationController.markAsRead);

router.put('/read-all', protect, notificationController.markAllAsRead);

module.exports = router;
