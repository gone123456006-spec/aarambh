const mongoose = require('mongoose');

const checkoutSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true,
    },
    couponCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    durationDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    originalPrice: {
      type: Number,
      required: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
    },
    couponIncremented: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

const CheckoutSession = mongoose.model('CheckoutSession', checkoutSessionSchema);

module.exports = CheckoutSession;
