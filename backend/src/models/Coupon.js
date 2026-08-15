const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: ['percent', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    maxUses: {
      type: Number,
      default: null,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    minPurchase: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

couponSchema.methods.isUsable = function isUsable() {
  if (!this.active) return { ok: false, reason: 'This coupon is disabled.' };
  if (this.expiresAt && this.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'This coupon has expired.' };
  }
  if (this.maxUses != null && this.usedCount >= this.maxUses) {
    return { ok: false, reason: 'This coupon has reached its usage limit.' };
  }
  return { ok: true };
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
