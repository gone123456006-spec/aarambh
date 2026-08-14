const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');
const razorpayService = require('./razorpayService');

const PLAN_PRICE = Subscription.PLAN_PRICE || 249;
const PLAN_NAME = 'Pro';
const PLAN_DURATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Return the user's most recent subscription record (any status), or null.
 * Also lazily flips a stale "active" record to "expired" once its window passes,
 * so status verification happens automatically on every read (login/app launch).
 */
async function getLatestSubscription(userId) {
  if (!userId) return null;

  const latest = await Subscription.findOne({ user: userId }).sort({ expiryDate: -1, createdAt: -1 });
  if (!latest) return null;

  if (latest.status === 'active' && latest.expiryDate && latest.expiryDate.getTime() <= Date.now()) {
    latest.status = 'expired';
    await latest.save();
  }

  return latest;
}

/** Whether the user currently has Pro access. */
async function hasActiveSubscription(userId) {
  const latest = await getLatestSubscription(userId);
  return !!(latest && latest.isCurrentlyActive());
}

function remainingDays(expiryDate) {
  if (!expiryDate) return 0;
  const ms = expiryDate.getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

/** Build a client-friendly summary of the user's subscription. */
async function getSubscriptionSummary(userId) {
  const latest = await getLatestSubscription(userId);
  const active = !!(latest && latest.isCurrentlyActive());

  if (!latest) {
    return {
      active: false,
      plan: 'Free',
      status: 'none',
      price: PLAN_PRICE,
      currency: 'INR',
      durationDays: PLAN_DURATION_DAYS,
      startDate: null,
      expiryDate: null,
      remainingDays: 0,
      transactionId: null,
      razorpayConfigured: razorpayService.isRazorpayConfigured(),
    };
  }

  return {
    active,
    plan: active ? PLAN_NAME : 'Free',
    status: latest.status,
    price: latest.price ?? PLAN_PRICE,
    currency: latest.currency || 'INR',
    durationDays: PLAN_DURATION_DAYS,
    startDate: latest.purchaseDate || latest.createdAt || null,
    expiryDate: latest.expiryDate || null,
    remainingDays: active ? remainingDays(latest.expiryDate) : 0,
    transactionId: latest.transactionId || latest.razorpayPaymentId || null,
    razorpayConfigured: razorpayService.isRazorpayConfigured(),
  };
}

/**
 * Create a Razorpay order for this user to buy/renew Pro.
 */
async function createCheckoutOrder(user) {
  const userId = user._id;
  const receipt = `pro_${String(userId).slice(-8)}_${Date.now().toString(36)}`;

  const order = await razorpayService.createOrder({
    amountInr: PLAN_PRICE,
    receipt,
    notes: {
      userId: String(userId),
      plan: PLAN_NAME,
      durationDays: String(PLAN_DURATION_DAYS),
    },
  });

  return {
    ...order,
    planName: PLAN_NAME,
    planPrice: PLAN_PRICE,
    durationDays: PLAN_DURATION_DAYS,
    description: `Pro Subscription — ${PLAN_DURATION_DAYS} days`,
    name: "Ohm's English",
    prefill: {
      name: user.name || '',
      email: user.email || '',
      contact: user.phone || '',
    },
    themeColor: '#e60000',
  };
}

/**
 * Activate Pro after a verified Razorpay payment.
 * Renewals extend from the current expiry (if still active) so paid days are never lost.
 */
async function activateFromRazorpayPayment(userId, { orderId, paymentId, signature }) {
  if (!razorpayService.verifyPaymentSignature({ orderId, paymentId, signature })) {
    throw new ApiError(400, 'Payment verification failed. Invalid Razorpay signature.');
  }

  // Idempotent: same payment must not create two subscriptions
  const existingPayment = await Subscription.findOne({ razorpayPaymentId: paymentId });
  if (existingPayment) {
    if (String(existingPayment.user) !== String(userId)) {
      throw new ApiError(403, 'This payment belongs to another account.');
    }
    return existingPayment;
  }

  const now = Date.now();
  const existing = await getLatestSubscription(userId);
  const base = existing && existing.isCurrentlyActive() ? existing.expiryDate.getTime() : now;
  const expiryDate = new Date(base + PLAN_DURATION_DAYS * DAY_MS);

  const subscription = await Subscription.create({
    user: userId,
    planName: PLAN_NAME,
    price: PLAN_PRICE,
    currency: 'INR',
    purchaseDate: new Date(now),
    expiryDate,
    status: 'active',
    paymentStatus: 'completed',
    transactionId: paymentId,
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
  });

  try {
    const notificationService = require('./notificationService');
    await notificationService.notifySubscriptionActivated(userId, { expiryDate });
  } catch (err) {
    console.error('Subscription notification failed:', err.message || err);
  }

  // Send confirmation email asynchronously (don't block subscription activation)
  (async () => {
    try {
      const User = require('../models/User');
      const emailService = require('./emailService');
      
      const user = await User.findById(userId).select('name email phone').lean();
      if (!user) return;
      
      const result = await emailService.sendSubscriptionConfirmationEmail(user, subscription);
      
      if (result.sent) {
        subscription.emailSent = true;
        subscription.emailSentAt = new Date();
        await subscription.save();
      }
    } catch (emailErr) {
      console.error('Subscription confirmation email failed:', emailErr.message || emailErr);
    }
  })();

  return subscription;
}

module.exports = {
  PLAN_PRICE,
  PLAN_NAME,
  PLAN_DURATION_DAYS,
  getLatestSubscription,
  hasActiveSubscription,
  getSubscriptionSummary,
  createCheckoutOrder,
  activateFromRazorpayPayment,
};
