const notificationService = require('../services/notificationService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

exports.getNotifications = asyncHandler(async (req, res) => {
  if (req.query.bootstrap !== '0') {
    try {
      await notificationService.bootstrapUserNotifications(req.user._id, { name: req.user.name });
    } catch (error) {
      console.warn('Notification bootstrap failed:', error.message);
    }
  }
  const notifications = await notificationService.getNotifications(req.user._id);
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.json(new ApiResponse(200, { notifications, unreadCount }, 'Notifications retrieved'));
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.json(new ApiResponse(200, { unreadCount }, 'Unread count retrieved'));
});

exports.bootstrap = asyncHandler(async (req, res) => {
  await notificationService.bootstrapUserNotifications(req.user._id, {
    isLogin: Boolean(req.body?.isLogin),
    isNewUser: Boolean(req.body?.isNewUser),
    name: req.user.name,
  });
  const notifications = await notificationService.getNotifications(req.user._id);
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.json(new ApiResponse(200, { notifications, unreadCount }, 'Notifications bootstrapped'));
});

exports.reportEvent = asyncHandler(async (req, res) => {
  const event = String(req.body?.event || '').trim();
  const payload = req.body?.payload || {};
  if (event === 'daily_reward_claimed') {
    await notificationService.notifyDailyRewardClaimed(req.user._id, payload);
  }
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.json(new ApiResponse(200, { unreadCount }, 'Event recorded'));
});

exports.markAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAsRead(req.params.id, req.user._id);
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.json(new ApiResponse(200, { unreadCount }, 'Marked as read'));
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user._id);
  res.json(new ApiResponse(200, { unreadCount: 0 }, 'All marked as read'));
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.user._id);
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.json(new ApiResponse(200, { unreadCount }, 'Notification deleted'));
});

exports.deleteAllNotifications = asyncHandler(async (req, res) => {
  await notificationService.deleteAllNotifications(req.user._id);
  res.json(new ApiResponse(200, { unreadCount: 0 }, 'All notifications deleted'));
});
