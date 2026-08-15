const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    region: {
      type: String,
      trim: true,
    },
    level: {
      type: String,
      enum: ['starting', 'beginner', 'intermediate', 'advanced'],
    },
    profileCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    referralCode: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    socketId: {
      type: String,
      default: null,
    },
    /**
     * Live practice availability. Busy users must not receive new
     * chat / voice / video requests until the session ends.
     */
    connectionState: {
      type: String,
      enum: ['available', 'chat_connected', 'voice_connected', 'video_connected'],
      default: 'available',
      index: true,
    },
    connectionSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatSession',
      default: null,
    },
    connectedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** Single-device login: only this device ID may hold an active session. */
    activeDeviceId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    activeDeviceBoundAt: {
      type: Date,
      default: null,
    },
    refreshTokens: [
      {
        type: String,
      },
    ],
    /** Account deletion fields */
    deletionPending: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletionRequestedAt: {
      type: Date,
      default: null,
    },
    scheduledDeletionAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound index matching the leaderboard sort: totalPoints DESC → _id ASC
 * Must be defined BEFORE mongoose.model() to register on the schema.
 * Run once in MongoDB:  db.users.createIndex({ totalPoints: -1, _id: 1 })
 */
userSchema.index({ totalPoints: -1, _id: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
