const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const crypto = require('crypto');

const CODE_RE = /^OHMS\d{3}[A-Z]{4}$/;

function randomDigits(n) {
  let out = '';
  for (let i = 0; i < n; i += 1) out += String(crypto.randomInt(0, 10));
  return out;
}

function randomLetters(n) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < n; i += 1) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}

/** OHMS + 3 numbers + 4 letters, e.g. OHMS482ABCD */
function generateCouponCode() {
  return `OHMS${randomDigits(3)}${randomLetters(4)}`;
}

async function generateUniqueCouponCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = generateCouponCode();
    const exists = await Coupon.exists({ code });
    if (!exists) return code;
  }
  throw new ApiError(500, 'Could not generate a unique coupon code. Try again.');
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

/** Treat a YYYY-MM-DD admin date as the end of that day in IST. */
function endOfDayIst(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const raw = String(value).trim();
  const day = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (day) return new Date(`${day[1]}T23:59:59.999+05:30`);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function computeDiscount(originalPrice, coupon) {
  const price = Math.max(0, Number(originalPrice) || 0);
  let discount = 0;
  if (coupon.discountType === 'percent') {
    discount = Math.round((price * Number(coupon.discountValue)) / 100);
  } else {
    discount = Math.round(Number(coupon.discountValue));
  }
  if (!Number.isFinite(discount) || discount < 0) discount = 0;
  discount = Math.min(discount, price);

  // Razorpay minimum charge is ₹1.
  let finalPrice = price - discount;
  if (price > 0 && finalPrice < 1) {
    discount = Math.max(0, price - 1);
    finalPrice = Math.max(1, price - discount);
  }

  return {
    originalPrice: price,
    discountAmount: discount,
    finalPrice,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    code: coupon.code,
  };
}

async function validateAndQuote(code, originalPrice) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    throw new ApiError(400, 'Enter a coupon code.');
  }
  if (!CODE_RE.test(normalized)) {
    throw new ApiError(400, 'Invalid coupon code format. Use OHMS + 3 numbers + 4 letters.');
  }

  const coupon = await Coupon.findOne({ code: normalized });
  if (!coupon) {
    throw new ApiError(400, 'This coupon code is not valid.');
  }

  const usable = coupon.isUsable();
  if (!usable.ok) {
    throw new ApiError(400, usable.reason);
  }

  const price = Math.max(0, Number(originalPrice) || 0);
  if (coupon.minPurchase && price < coupon.minPurchase) {
    throw new ApiError(400, `This coupon requires a minimum purchase of ₹${coupon.minPurchase}.`);
  }

  return {
    coupon,
    quote: computeDiscount(price, coupon),
  };
}

async function incrementUsage(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  await Coupon.updateOne({ code: normalized }, { $inc: { usedCount: 1 } });
}

module.exports = {
  CODE_RE,
  generateCouponCode,
  generateUniqueCouponCode,
  normalizeCode,
  endOfDayIst,
  computeDiscount,
  validateAndQuote,
  incrementUsage,
};
