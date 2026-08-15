const mongoose = require('mongoose');

/**
 * Tracks when automated daily notifications were last sent to users.
 * Ensures users only get one automatic notification per day.
 */
const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notificationType: {
      type: String,
      required: true,
      enum: ['daily_engagement', 'welcome', 'subscription_reminder', 'course_update', 'other'],
      default: 'daily_engagement',
    },
    lastSentAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    messageKey: {
      type: String,
      required: true,
    },
    delivered: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for efficient daily notification queries
notificationLogSchema.index({ userId: 1, notificationType: 1, lastSentAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
