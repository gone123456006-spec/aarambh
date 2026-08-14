const AdminNotification = require('../models/AdminNotification');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all admin notifications with pagination
 */
const getAdminNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;
  const status = req.query.status;

  const query = {};
  if (status) {
    query.status = status;
  }

  const [notifications, total] = await Promise.all([
    AdminNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean(),
    AdminNotification.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      },
      'Admin notifications retrieved successfully'
    )
  );
});

/**
 * Get a single admin notification by ID
 */
const getAdminNotificationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await AdminNotification.findById(id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.status(200).json(
    new ApiResponse(200, notification, 'Notification retrieved successfully')
  );
});

/**
 * Create a new admin notification (draft or immediate)
 */
const createAdminNotification = asyncHandler(async (req, res) => {
  const {
    title,
    message,
    type,
    targetAudience,
    targetRegions,
    targetLevels,
    targetUserIds,
    scheduledFor,
    data,
  } = req.body;

  if (!title?.trim() || !message?.trim()) {
    throw new ApiError(400, 'Title and message are required');
  }

  const notification = new AdminNotification({
    title: title.trim(),
    message: message.trim(),
    type: type || 'system',
    targetAudience: targetAudience || 'all',
    targetRegions: targetRegions || [],
    targetLevels: targetLevels || [],
    targetUserIds: targetUserIds || [],
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    status: scheduledFor ? 'scheduled' : 'draft',
    data: data || null,
    createdBy: req.user._id,
  });

  await notification.save();

  // If immediate send (no schedule), send now
  if (!scheduledFor) {
    await sendNotificationToUsers(notification);
  }

  res.status(201).json(
    new ApiResponse(201, notification, 'Notification created successfully')
  );
});

/**
 * Update an existing admin notification
 */
const updateAdminNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    message,
    type,
    targetAudience,
    targetRegions,
    targetLevels,
    targetUserIds,
    scheduledFor,
    data,
    status,
  } = req.body;

  const notification = await AdminNotification.findById(id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  // Cannot edit sent or cancelled notifications
  if (notification.status === 'sent' || notification.status === 'cancelled') {
    throw new ApiError(400, `Cannot edit ${notification.status} notifications`);
  }

  if (title !== undefined) notification.title = title.trim();
  if (message !== undefined) notification.message = message.trim();
  if (type !== undefined) notification.type = type;
  if (targetAudience !== undefined) notification.targetAudience = targetAudience;
  if (targetRegions !== undefined) notification.targetRegions = targetRegions;
  if (targetLevels !== undefined) notification.targetLevels = targetLevels;
  if (targetUserIds !== undefined) notification.targetUserIds = targetUserIds;
  if (scheduledFor !== undefined) {
    notification.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
  }
  if (data !== undefined) notification.data = data;
  if (status !== undefined) notification.status = status;

  notification.updatedBy = req.user._id;

  await notification.save();

  res.status(200).json(
    new ApiResponse(200, notification, 'Notification updated successfully')
  );
});

/**
 * Delete an admin notification
 */
const deleteAdminNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await AdminNotification.findById(id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  // Can only delete draft or scheduled notifications
  if (notification.status === 'sending' || notification.status === 'sent') {
    throw new ApiError(400, `Cannot delete ${notification.status} notifications`);
  }

  await AdminNotification.findByIdAndDelete(id);

  res.status(200).json(
    new ApiResponse(200, null, 'Notification deleted successfully')
  );
});

/**
 * Send an admin notification immediately (or trigger scheduled send)
 */
const sendAdminNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await AdminNotification.findById(id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (notification.status === 'sent') {
    throw new ApiError(400, 'Notification already sent');
  }

  if (notification.status === 'cancelled') {
    throw new ApiError(400, 'Cannot send cancelled notification');
  }

  notification.status = 'sending';
  await notification.save();

  const result = await sendNotificationToUsers(notification);

  res.status(200).json(
    new ApiResponse(
      200,
      result,
      `Notification sent to ${result.sentCount} users successfully`
    )
  );
});

/**
 * Cancel a scheduled notification
 */
const cancelAdminNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await AdminNotification.findById(id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (notification.status === 'sent') {
    throw new ApiError(400, 'Cannot cancel already sent notification');
  }

  notification.status = 'cancelled';
  notification.updatedBy = req.user._id;
  await notification.save();

  res.status(200).json(
    new ApiResponse(200, notification, 'Notification cancelled successfully')
  );
});

/**
 * Preview target users for a notification
 */
const previewNotificationTargets = asyncHandler(async (req, res) => {
  const { targetAudience, targetRegions, targetLevels, targetUserIds } = req.body;

  const tempNotification = new AdminNotification({
    title: 'Preview',
    message: 'Preview',
    targetAudience: targetAudience || 'all',
    targetRegions: targetRegions || [],
    targetLevels: targetLevels || [],
    targetUserIds: targetUserIds || [],
    createdBy: req.user._id,
  });

  const query = tempNotification.buildUserQuery();
  const count = await User.countDocuments(query);

  const sample = await User.find(query)
    .select('name email region level')
    .limit(10)
    .lean();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        count,
        sample,
      },
      `Preview: ${count} users will receive this notification`
    )
  );
});

/**
 * Helper: Send notification to all target users
 */
async function sendNotificationToUsers(adminNotification) {
  const query = adminNotification.buildUserQuery();
  const users = await User.find(query).select('_id').lean();

  const userIds = users.map((u) => u._id);

  const notifications = userIds.map((userId) => ({
    user: userId,
    title: adminNotification.title,
    message: adminNotification.message,
    type: adminNotification.type,
    data: adminNotification.data,
    read: false,
  }));

  let sentCount = 0;
  if (notifications.length > 0) {
    const result = await Notification.insertMany(notifications, { ordered: false });
    sentCount = result.length;
  }

  adminNotification.recipientCount = userIds.length;
  adminNotification.sentCount = sentCount;
  adminNotification.status = 'sent';
  adminNotification.sentAt = new Date();
  await adminNotification.save();

  return {
    recipientCount: userIds.length,
    sentCount,
  };
}

module.exports = {
  getAdminNotifications,
  getAdminNotificationById,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
  sendAdminNotification,
  cancelAdminNotification,
  previewNotificationTargets,
};
