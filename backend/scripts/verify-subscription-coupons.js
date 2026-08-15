/**
 * Offline checks for coupon format and discount math (no database).
 * Run: node scripts/verify-subscription-coupons.js
 */
const assert = require('assert');
const couponService = require('../src/services/couponService');
const planService = require('../src/services/planService');

function testCodes() {
  for (let i = 0; i < 50; i += 1) {
    const code = couponService.generateCouponCode();
    assert.match(code, couponService.CODE_RE, `generated code ${code}`);
    assert.strictEqual(code.length, 11);
    assert.ok(code.startsWith('OHMS'));
  }
}

function testDiscountMath() {
  const percent = couponService.computeDiscount(249, {
    discountType: 'percent',
    discountValue: 20,
    code: 'OHMS123ABCD',
  });
  assert.strictEqual(percent.originalPrice, 249);
  assert.strictEqual(percent.discountAmount, 50);
  assert.strictEqual(percent.finalPrice, 199);

  const hundred = couponService.computeDiscount(249, {
    discountType: 'percent',
    discountValue: 100,
    code: 'OHMS123ABCD',
  });
  assert.strictEqual(hundred.finalPrice, 1, 'Razorpay min ₹1');
  assert.strictEqual(hundred.discountAmount, 248);

  const fixed = couponService.computeDiscount(249, {
    discountType: 'fixed',
    discountValue: 50,
    code: 'OHMS123ABCD',
  });
  assert.strictEqual(fixed.finalPrice, 199);

  const overflow = couponService.computeDiscount(99, {
    discountType: 'fixed',
    discountValue: 500,
    code: 'OHMS123ABCD',
  });
  assert.strictEqual(overflow.finalPrice, 1);
  assert.ok(overflow.discountAmount <= 99);

  const invalidFmt = couponService.CODE_RE.test('WELCOME50');
  assert.strictEqual(invalidFmt, false);
  assert.strictEqual(couponService.CODE_RE.test('OHMS482ABCD'), true);
  assert.strictEqual(couponService.CODE_RE.test('ohms482abcd'), false);
}

function testPaidCategory() {
  assert.strictEqual(planService.isPaidCategory({ enabled: true, price: 249 }), true);
  assert.strictEqual(planService.isPaidCategory({ enabled: false, price: 249 }), false);
  assert.strictEqual(planService.isPaidCategory({ enabled: true, price: 0 }), false);
}

function testOptionalCoupon() {
  assert.strictEqual(couponService.normalizeCode(''), '');
  assert.strictEqual(couponService.normalizeCode(null), '');
  assert.strictEqual(couponService.normalizeCode(undefined), '');
  assert.strictEqual(couponService.normalizeCode('   '), '');
  assert.strictEqual(couponService.normalizeCode('ohms482abcd'), 'OHMS482ABCD');
  assert.ok(!couponService.normalizeCode(''), 'empty coupon must be skipped');
  assert.ok(couponService.normalizeCode('OHMS482ABCD'), 'valid coupon is used');
}

function testExpiry() {
  const end = couponService.endOfDayIst('2026-08-20');
  assert.ok(end instanceof Date);
  assert.strictEqual(end.toISOString().startsWith('2026-08-20'), true);
}

testCodes();
testDiscountMath();
testPaidCategory();
testOptionalCoupon();
testExpiry();
console.log('Subscription/coupon checks passed.');
