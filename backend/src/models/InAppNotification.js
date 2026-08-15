const mongoose = require('mongoose');

const TYPES = [
  'system',
  'welcome',
  'reward',
  'course',
  'game',
  'points',
  'leaderboard',
  'subscription',
  'chat',
  'call',
  'achievement',
];

const inAppNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: TYPES, default: 'system', index: true },
    read: { type: Boolean, default: false, index: true },
    key: { type: String },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

inAppNotificationSchema.index({ user: 1, createdAt: -1 });
inAppNotificationSchema.index({ user: 1, key: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('InAppNotification', inAppNotificationSchema);
