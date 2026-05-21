const notificationService = require('../services/notificationService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all notifications for the authenticated user
 */
const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationService.getUnreadNotifications(req.user._id);
  res.status(200).json(new ApiResponse(200, notifications, 'Notifications retrieved successfully'));
});

/**
 * Mark a specific notification as read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await notificationService.markAsRead(id, req.user._id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));
});

/**
 * Mark all notifications as read for the authenticated user
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user._id);
  res.status(200).json(new ApiResponse(200, null, 'All notifications marked as read'));
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
