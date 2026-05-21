const Notification = require('../models/Notification');

/**
 * Create a new notification for a user
 */
const createNotification = async (userId, title, message, type = 'system') => {
  try {
    const notification = new Notification({
      user: userId,
      title,
      message,
      type,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

/**
 * Retrieve user's unread notifications count
 */
const getUnreadNotifications = async (userId) => {
  return await Notification.find({ user: userId, read: false }).sort({ createdAt: -1 });
};

/**
 * Mark a specific notification as read
 */
const markAsRead = async (notificationId, userId) => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { read: true } },
    { new: true }
  );
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
  return await Notification.updateMany(
    { user: userId, read: false },
    { $set: { read: true } }
  );
};

module.exports = {
  createNotification,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
};
