const firebaseService = require('../services/firebaseService');
const dailyNotificationService = require('../services/dailyNotificationService');
const { triggerDailyNotificationsNow } = require('../services/notificationScheduler');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Register a device token for push notifications.
 * POST /api/app/device-token
 * Body: { token, platform?, model?, osVersion? }
 */
exports.registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform, model, osVersion, tokenType, appOwnership, executionEnvironment } =
    req.body;

  if (!token || typeof token !== 'string' || token.trim().length < 20) {
    throw new ApiError(400, 'Valid push token is required');
  }

  const deviceInfo = {
    platform,
    model,
    osVersion,
    appOwnership,
    executionEnvironment,
  };
  const deviceToken = await firebaseService.registerToken(
    req.user._id,
    token.trim(),
    deviceInfo,
    tokenType
  );

  res.json({
    success: true,
    message: 'Device token registered successfully',
    data: {
      tokenId: deviceToken._id,
      isActive: deviceToken.isActive,
      tokenType: deviceToken.tokenType,
    },
  });
});

/**
 * Unregister a device token.
 * DELETE /api/app/device-token
 * Body: { token }
 */
exports.unregisterDeviceToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new ApiError(400, 'Token is required');
  }

  await firebaseService.unregisterToken(token);

  res.json({
    success: true,
    message: 'Device token unregistered successfully',
  });
});

/**
 * Send a push notification (Admin only).
 * POST /api/admin/notifications/send
 * Body: { title, body, imageUrl?, data?, targetType: 'all' | 'specific', targetUserIds? }
 */
exports.sendNotification = asyncHandler(async (req, res) => {
  const { title, body, imageUrl, data, targetType, targetUserIds } = req.body;

  if (!title || !body) {
    throw new ApiError(400, 'Title and body are required');
  }

  if (targetType === 'specific' && (!targetUserIds || targetUserIds.length === 0)) {
    throw new ApiError(400, 'Target user IDs are required for specific notifications');
  }

  const { notification, result } = await firebaseService.createAndSendNotification({
    title,
    body,
    imageUrl,
    data,
    targetType: targetType || 'all',
    targetUserIds: targetUserIds || [],
    sentBy: req.user._id,
  });

  res.json({
    success: true,
    message: `Notification sent to ${result.successCount} device(s)`,
    data: {
      notificationId: notification._id,
      totalSent: notification.totalSent,
      successCount: notification.successCount,
      failureCount: notification.failureCount,
    },
  });
});

/**
 * Get notification history (Admin only).
 * GET /api/admin/notifications/history
 * Query: ?limit=20&skip=0
 */
exports.getNotificationHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

  const notifications = await Notification.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('sentBy', 'name email')
    .lean();

  const total = await Notification.countDocuments();

  res.json({
    success: true,
    data: {
      notifications,
      total,
      limit,
      skip,
    },
  });
});

/**
 * Get notification stats (Admin only).
 * GET /api/admin/push-notifications/stats
 */
exports.getNotificationStats = asyncHandler(async (req, res) => {
  const DeviceToken = require('../models/DeviceToken');

  const [totalUsers, activeTokens, totalNotifications, recentNotifications, dailyStats] = await Promise.all([
    User.countDocuments(),
    DeviceToken.countDocuments({ isActive: true }),
    Notification.countDocuments(),
    Notification.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    dailyNotificationService.getDailyNotificationStats(),
  ]);

  const uniqueUsers = await DeviceToken.distinct('userId', { isActive: true });
  const [expoTokens, fcmTokens] = await Promise.all([
    DeviceToken.countDocuments({ isActive: true, tokenType: 'expo' }),
    DeviceToken.countDocuments({
      isActive: true,
      $or: [{ tokenType: 'fcm' }, { tokenType: 'unknown', token: { $not: /^ExponentPushToken/ } }],
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      activeDevices: activeTokens,
      usersWithNotifications: uniqueUsers.length,
      totalNotificationsSent: totalNotifications,
      last7Days: recentNotifications,
      firebaseEnabled: firebaseService.isFirebaseEnabled(),
      expoTokens,
      fcmTokens,
      dailyNotifications: dailyStats,
    },
  });
});

/**
 * Test notification to current user (for testing).
 * POST /api/app/test-notification
 */
exports.testNotification = asyncHandler(async (req, res) => {
  const title = 'Test Notification';
  const body = "This is a test notification from Ohm's!";
  const data = { type: 'system' };

  let result = { successCount: 0, failureCount: 0 };
  try {
    result = await firebaseService.sendToUsers([req.user._id], { title, body }, data);
  } catch (error) {
    console.warn('Test push send failed:', error.message);
  }

  await firebaseService.fanoutInAppNotifications({
    title,
    body,
    data,
    targetType: 'specific',
    targetUserIds: [req.user._id],
  });

  res.json({
    success: true,
    message: 'Test notification sent',
    data: {
      ...result,
      firebaseEnabled: firebaseService.isFirebaseEnabled(),
    },
  });
});

/**
 * Manually trigger daily notifications to all users (Admin only).
 * POST /api/admin/push-notifications/trigger-daily
 */
exports.triggerDailyNotifications = asyncHandler(async (req, res) => {
  const stats = await triggerDailyNotificationsNow();

  res.json({
    success: true,
    message: 'Daily notifications triggered successfully',
    data: stats,
  });
});

/**
 * Get daily notification stats and message pool (Admin only).
 * GET /api/admin/push-notifications/daily-config
 */
exports.getDailyNotificationConfig = asyncHandler(async (req, res) => {
  const stats = await dailyNotificationService.getDailyNotificationStats();
  
  res.json({
    success: true,
    data: {
      schedule: process.env.DAILY_NOTIFICATION_SCHEDULE || '30 4 * * * (10:00 AM IST)',
      stats,
      messagePool: dailyNotificationService.NOTIFICATION_MESSAGES.map(msg => ({
        key: msg.key,
        title: msg.title,
        body: msg.body,
      })),
      totalMessages: dailyNotificationService.NOTIFICATION_MESSAGES.length,
    },
  });
});
