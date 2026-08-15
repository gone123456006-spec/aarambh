const mongoose = require('mongoose');

/**
 * Stores notification history for tracking and analytics.
 */
const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Target audience
    targetType: {
      type: String,
      enum: ['all', 'specific', 'test'],
      default: 'all',
    },
    targetUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Sending stats
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    totalSent: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ targetType: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
