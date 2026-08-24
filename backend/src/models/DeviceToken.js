const mongoose = require('mongoose');

/**
 * Stores FCM device tokens for push notifications.
 * Each user can have multiple devices.
 */
const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenType: {
      type: String,
      enum: ['fcm', 'expo', 'unknown'],
      default: 'unknown',
      index: true,
    },
    deviceInfo: {
      platform: { type: String }, // 'ios' | 'android'
      model: { type: String },
      osVersion: { type: String },
      appOwnership: { type: String },
      executionEnvironment: { type: String },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for finding active tokens
deviceTokenSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
