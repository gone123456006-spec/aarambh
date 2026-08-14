const mongoose = require('mongoose');

/**
 * Admin-created notifications for broadcast or targeted delivery.
 * Supports scheduling, targeting, and delivery tracking.
 */
const adminNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['system', 'announcement', 'feature', 'maintenance', 'promotion'],
      default: 'system',
      index: true,
    },
    // Targeting
    targetAudience: {
      type: String,
      enum: ['all', 'region', 'level', 'active', 'custom'],
      default: 'all',
      index: true,
    },
    targetRegions: {
      type: [String],
      default: [],
    },
    targetLevels: {
      type: [String],
      default: [],
    },
    targetUserIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    // Scheduling
    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'cancelled'],
      default: 'draft',
      index: true,
    },
    // Delivery tracking
    recipientCount: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    // Optional deep-link / payload
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

adminNotificationSchema.index({ status: 1, scheduledFor: 1 });
adminNotificationSchema.index({ createdBy: 1, createdAt: -1 });

/**
 * Build a MongoDB query to match target users
 */
adminNotificationSchema.methods.buildUserQuery = function () {
  const query = { role: 'user' };

  if (this.targetAudience === 'all') {
    return query;
  }

  if (this.targetAudience === 'region' && this.targetRegions.length > 0) {
    query.region = { $in: this.targetRegions };
  }

  if (this.targetAudience === 'level' && this.targetLevels.length > 0) {
    query.level = { $in: this.targetLevels };
  }

  if (this.targetAudience === 'active') {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query.lastSeen = { $gte: last7Days };
  }

  if (this.targetAudience === 'custom' && this.targetUserIds.length > 0) {
    query._id = { $in: this.targetUserIds };
  }

  return query;
};

/**
 * Check if this notification is ready to send
 */
adminNotificationSchema.methods.isReadyToSend = function () {
  if (this.status === 'sent' || this.status === 'cancelled') {
    return false;
  }

  if (this.status === 'draft') {
    return false;
  }

  if (this.scheduledFor && this.scheduledFor > new Date()) {
    return false;
  }

  return true;
};

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

module.exports = AdminNotification;
