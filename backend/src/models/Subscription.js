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
    price: {
      type: Number,
      default: PLAN_PRICE,
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
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
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
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ user: 1, expiryDate: -1 });

/** True when this record is still within its paid window. */
subscriptionSchema.methods.isCurrentlyActive = function isCurrentlyActive() {
  return this.status === 'active' && this.expiryDate instanceof Date && this.expiryDate.getTime() > Date.now();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
module.exports.PLAN_PRICE = PLAN_PRICE;
