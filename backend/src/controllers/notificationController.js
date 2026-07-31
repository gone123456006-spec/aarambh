const notificationService = require('../services/notificationService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/notifications
 * Returns recent notifications + unread count. Also bootstraps auto notifications on open.
 */
const getNotifications = asyncHandler(async (req, res) => {
  const unreadOnly = String(req.query.unreadOnly || '') === 'true';
  const skipBootstrap = String(req.query.bootstrap || '1') === '0';

  if (!skipBootstrap) {
    await notificationService.bootstrapUserNotifications(req.user._id, { isLogin: false });
  }

  const [notifications, unreadCount] = await Promise.all([
    notificationService.getNotifications(req.user._id, {
      limit: 60,
      unreadOnly,
    }),
    notificationService.getUnreadCount(req.user._id),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { notifications, unreadCount },
      'Notifications retrieved successfully'
    )
  );
});

/** GET /api/notifications/unread-count */
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.status(200).json(new ApiResponse(200, { unreadCount }, 'Unread count retrieved'));
});

/** POST /api/notifications/bootstrap — force auto-send on login / app open */
const bootstrap = asyncHandler(async (req, res) => {
  const isLogin = Boolean(req.body?.isLogin);
  const result = await notificationService.bootstrapUserNotifications(req.user._id, { isLogin });
  const [notifications, unreadCount] = await Promise.all([
    notificationService.getNotifications(req.user._id, { limit: 60 }),
    notificationService.getUnreadCount(req.user._id),
  ]);
  res.status(200).json(
    new ApiResponse(200, { ...result, notifications, unreadCount }, 'Notifications refreshed')
  );
});

/**
 * POST /api/notifications/events — frontend events (daily reward claim, etc.)
 * Body: { event, payload }
 */
const reportEvent = asyncHandler(async (req, res) => {
  const { event, payload = {} } = req.body || {};
  const userId = req.user._id;

  switch (event) {
    case 'daily_reward_claimed':
      await notificationService.notifyDailyRewardClaimed(userId, payload);
      break;
    case 'chat_tip':
      await notificationService.notifyChatTip(userId);
      break;
    case 'call_tip':
      await notificationService.notifyCallTip(userId);
      break;
    default:
      throw new ApiError(400, `Unknown notification event: ${event || '(empty)'}`);
  }

  const unreadCount = await notificationService.getUnreadCount(userId);
  res.status(200).json(new ApiResponse(200, { unreadCount }, 'Event recorded'));
});

const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await notificationService.markAsRead(id, req.user._id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user._id);
  res.status(200).json(new ApiResponse(200, { unreadCount: 0 }, 'All notifications marked as read'));
});

/** DELETE /api/notifications/:id */
const deleteNotification = asyncHandler(async (req, res) => {
  const deleted = await notificationService.deleteNotification(req.params.id, req.user._id);
  if (!deleted) {
    throw new ApiError(404, 'Notification not found or access denied');
  }
  const unreadCount = await notificationService.getUnreadCount(req.user._id);
  res.status(200).json(new ApiResponse(200, { id: req.params.id, unreadCount }, 'Notification deleted'));
});

/** DELETE /api/notifications — clear all for this user */
const deleteAllNotifications = asyncHandler(async (req, res) => {
  await notificationService.deleteAllNotifications(req.user._id);
  res.status(200).json(new ApiResponse(200, { unreadCount: 0 }, 'All notifications deleted'));
});

module.exports = {
  getNotifications,
  getUnreadCount,
  bootstrap,
  reportEvent,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};
