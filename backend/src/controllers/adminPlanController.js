const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Coupon = require('../models/Coupon');
const planService = require('../services/planService');
const couponService = require('../services/couponService');

const getSubscriptionPlans = asyncHandler(async (req, res) => {
  const plans = await planService.listPlans();
  res.status(200).json(new ApiResponse(200, { plans }, 'Subscription plans retrieved'));
});

const updateSubscriptionPlan = asyncHandler(async (req, res) => {
  try {
    const plan = await planService.updatePlan(req.params.category, req.body || {});
    res.status(200).json(new ApiResponse(200, plan, 'Subscription plan updated'));
  } catch (err) {
    throw new ApiError(err.statusCode || 400, err.message);
  }
});

const listCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
  res.status(200).json(new ApiResponse(200, { coupons }, 'Coupons retrieved'));
});

const createCoupon = asyncHandler(async (req, res) => {
  const { discountType, discountValue, expiresAt, maxUses, minPurchase, description, active } = req.body || {};
  if (!['percent', 'fixed'].includes(discountType)) {
    throw new ApiError(400, 'Discount type must be percent or fixed.');
  }
  const value = Number(discountValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, 'Enter a discount greater than 0.');
  }
  if (discountType === 'percent' && value > 100) {
    throw new ApiError(400, 'Percentage discount cannot exceed 100.');
  }

  const code = await couponService.generateUniqueCouponCode();
  const coupon = await Coupon.create({
    code,
    discountType,
    discountValue: value,
    active: active !== false,
    expiresAt: expiresAt ? couponService.endOfDayIst(expiresAt) : null,
    maxUses: maxUses ? parseInt(maxUses, 10) : null,
    minPurchase: minPurchase ? Number(minPurchase) : 0,
    description: description || '',
    createdBy: req.user?._id || null,
  });

  res.status(201).json(new ApiResponse(201, coupon, 'Coupon created'));
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  const { discountType, discountValue, expiresAt, maxUses, minPurchase, description, active } = req.body || {};
  if (discountType) {
    if (!['percent', 'fixed'].includes(discountType)) {
      throw new ApiError(400, 'Discount type must be percent or fixed.');
    }
    coupon.discountType = discountType;
  }
  if (discountValue != null) {
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw new ApiError(400, 'Enter a discount greater than 0.');
    }
    if ((discountType || coupon.discountType) === 'percent' && value > 100) {
      throw new ApiError(400, 'Percentage discount cannot exceed 100.');
    }
    coupon.discountValue = value;
  }
  if (active != null) {
    coupon.active = active === true || active === 'true' || active === 1 || active === '1';
  }
  if (expiresAt !== undefined) coupon.expiresAt = expiresAt ? couponService.endOfDayIst(expiresAt) : null;
  if (maxUses !== undefined) coupon.maxUses = maxUses ? parseInt(maxUses, 10) : null;
  if (minPurchase !== undefined) coupon.minPurchase = Number(minPurchase) || 0;
  if (description !== undefined) coupon.description = String(description || '');

  await coupon.save();
  res.status(200).json(new ApiResponse(200, coupon, 'Coupon updated'));
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  res.status(200).json(new ApiResponse(200, { id: req.params.id }, 'Coupon deleted'));
});

module.exports = {
  getSubscriptionPlans,
  updateSubscriptionPlan,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
