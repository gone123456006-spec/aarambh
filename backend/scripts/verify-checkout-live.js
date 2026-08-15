/**
 * Live checkout checks against MongoDB (no Razorpay charge).
 * Run from backend/: node scripts/verify-checkout-live.js
 */
require('dotenv').config();
const assert = require('assert');
const connectDB = require('../src/config/db');
const planService = require('../src/services/planService');
const couponService = require('../src/services/couponService');
const subscriptionService = require('../src/services/subscriptionService');
const Coupon = require('../src/models/Coupon');
const mongoose = require('mongoose');

async function main() {
  await connectDB();
  await planService.ensureDefaultPlans();

  const plans = await planService.listPlans();
  const paid = plans.find((p) => planService.isPaidCategory(p)) || plans.find((p) => p.category === 'intermediate');
  assert.ok(paid, 'Need at least one category plan');

  const category = paid.category;
  const original = Number(paid.price);

  const noCoupon = await subscriptionService.quotePurchase(category, '');
  assert.strictEqual(noCoupon.couponApplied, false);
  assert.strictEqual(noCoupon.discountAmount, 0);
  assert.strictEqual(noCoupon.finalPrice, original);
  assert.strictEqual(noCoupon.couponCode, null);

  const nullCoupon = await subscriptionService.quotePurchase(category, null);
  assert.strictEqual(nullCoupon.finalPrice, original);

  let invalidFailed = false;
  try {
    await subscriptionService.quotePurchase(category, 'WELCOME50');
  } catch (err) {
    invalidFailed = /invalid coupon code format/i.test(err.message);
  }
  assert.ok(invalidFailed, 'junk coupon must be rejected');

  let missingFailed = false;
  try {
    await subscriptionService.quotePurchase(category, 'OHMS000ZZZZ');
  } catch (err) {
    missingFailed = /not valid/i.test(err.message);
  }
  assert.ok(missingFailed, 'unknown OHMS code must be rejected');

  const code = await couponService.generateUniqueCouponCode();
  const coupon = await Coupon.create({
    code,
    discountType: 'percent',
    discountValue: 20,
    active: true,
    description: 'live-check-temp',
  });

  try {
    const withCoupon = await subscriptionService.quotePurchase(category, code);
    assert.strictEqual(withCoupon.couponApplied, true);
    assert.strictEqual(withCoupon.couponCode, code);
    assert.strictEqual(withCoupon.originalPrice, original);
    assert.ok(withCoupon.discountAmount > 0);
    assert.strictEqual(withCoupon.finalPrice, original - withCoupon.discountAmount);

    await Coupon.updateOne({ _id: coupon._id }, { $set: { active: false } });
    let disabledFailed = false;
    try {
      await subscriptionService.quotePurchase(category, code);
    } catch (err) {
      disabledFailed = /disabled/i.test(err.message);
    }
    assert.ok(disabledFailed, 'disabled coupon must be rejected');
  } finally {
    await Coupon.deleteOne({ _id: coupon._id });
  }

  console.log(`Checkout live checks passed for ${category} at ₹${original} (coupon optional).`);
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Checkout live checks failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
