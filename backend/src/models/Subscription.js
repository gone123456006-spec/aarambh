const mongoose = require('mongoose');

const PLAN_PRICE = 249;

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planName: {
      type: String,
      default: 'Pro',
      trim: true,
    },
    category: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'all'],
      default: 'all',
      index: true,
    },
    price: {
      type: Number,
      default: PLAN_PRICE,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      trim: true,
      default: null,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    /** Razorpay payment id (pay_…) — primary payment reference */
    transactionId: {
      type: String,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ user: 1, expiryDate: -1 });
subscriptionSchema.index({ user: 1, status: 1, category: 1 });

/** True when this record is still within its paid window. */
subscriptionSchema.methods.isCurrentlyActive = function isCurrentlyActive() {
  return this.status === 'active' && this.expiryDate instanceof Date && this.expiryDate.getTime() > Date.now();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
module.exports.PLAN_PRICE = PLAN_PRICE;
