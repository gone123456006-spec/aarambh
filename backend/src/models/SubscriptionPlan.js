const mongoose = require('mongoose');

const CATEGORIES = ['beginner', 'intermediate', 'advanced'];

const subscriptionPlanSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 249,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    durationDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    /** When false, this category is free and cannot be purchased. */
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;
module.exports.CATEGORIES = CATEGORIES;
