const Subscription = require('../models/Subscription');
const CheckoutSession = require('../models/CheckoutSession');
const ApiError = require('../utils/ApiError');
const razorpayService = require('./razorpayService');
const planService = require('./planService');
const couponService = require('./couponService');
const { slugifyLevel } = require('../constants/curriculum');

const PLAN_PRICE = Subscription.PLAN_PRICE || 249;
const PLAN_NAME = 'Pro';
const PLAN_DURATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function remainingDays(expiryDate) {
  if (!expiryDate) return 0;
  const ms = expiryDate.getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

async function expireIfNeeded(sub) {
  if (sub && sub.status === 'active' && sub.expiryDate && sub.expiryDate.getTime() <= Date.now()) {
    sub.status = 'expired';
    await sub.save();
  }
  return sub;
}

async function getLatestSubscription(userId) {
  if (!userId) return null;
  const latest = await Subscription.findOne({ user: userId }).sort({ expiryDate: -1, createdAt: -1 });
  if (!latest) return null;
  return expireIfNeeded(latest);
}

async function listActiveSubscriptions(userId) {
  if (!userId) return [];
  await Subscription.updateMany(
    { user: userId, status: 'active', expiryDate: { $lte: new Date() } },
    { $set: { status: 'expired' } }
  );
  return Subscription.find({
    user: userId,
    status: 'active',
    expiryDate: { $gt: new Date() },
  }).sort({ expiryDate: -1 });
}

function coversCategory(subscription, category) {
  if (!subscription) return false;
  const cat = String(category || '').toLowerCase();
  const subCat = subscription.category || 'all';
  if (subCat === cat) return true;
  // Legacy Pro / "all" unlocks every paid category.
  return subCat === 'all';
}

/** Whether the user currently has any paid access. */
async function hasActiveSubscription(userId) {
  const active = await listActiveSubscriptions(userId);
  return active.length > 0;
}

/** Whether this course category is unlocked for the user. */
async function hasAccessToCategory(userId, level) {
  const { slugifyLevel } = require('../constants/curriculum');
  const { CATEGORIES } = require('../models/SubscriptionPlan');
  const levelSlug = slugifyLevel(level);

  if (!CATEGORIES.includes(levelSlug)) {
    return true;
  }

  const plan = await planService.getPlan(levelSlug);
  if (!plan || !planService.isPaidCategory(plan)) return true;
  const active = await listActiveSubscriptions(userId);
  return active.some((sub) => coversCategory(sub, plan.category));
}

function formatPlan(plan) {
  return {
    category: plan.category,
    title: plan.title,
    price: plan.price,
    currency: plan.currency || 'INR',
    durationDays: plan.durationDays || PLAN_DURATION_DAYS,
    enabled: Boolean(plan.enabled),
    requiresPayment: planService.isPaidCategory(plan),
  };
}

async function quotePurchase(category, couponCode) {
  const plan = await planService.getPlan(category);
  if (!plan || !planService.isPaidCategory(plan)) {
    throw new ApiError(400, 'This category does not require a paid subscription right now.');
  }

  const originalPrice = Number(plan.price);
  const code = couponService.normalizeCode(couponCode);
  if (!code) {
    return {
      category: plan.category,
      title: plan.title,
      durationDays: plan.durationDays,
      originalPrice,
      discountAmount: 0,
      finalPrice: originalPrice,
      couponCode: null,
      couponApplied: false,
    };
  }

  const { quote } = await couponService.validateAndQuote(code, originalPrice);
  return {
    category: plan.category,
    title: plan.title,
    durationDays: plan.durationDays,
    originalPrice: quote.originalPrice,
    discountAmount: quote.discountAmount,
    finalPrice: quote.finalPrice,
    couponCode: quote.code,
    couponApplied: quote.discountAmount > 0,
    discountType: quote.discountType,
    discountValue: quote.discountValue,
  };
}

async function getSubscriptionSummary(userId) {
  const [latest, plans, active] = await Promise.all([
    getLatestSubscription(userId),
    planService.listPlans(),
    listActiveSubscriptions(userId),
  ]);

  const access = {};
  for (const plan of plans) {
    if (!planService.isPaidCategory(plan)) {
      access[plan.category] = true;
    } else {
      access[plan.category] = active.some((sub) => coversCategory(sub, plan.category));
    }
  }

  const paidPlans = plans.filter((p) => planService.isPaidCategory(p));
  const defaultPrice = paidPlans[0]?.price ?? PLAN_PRICE;
  const currentlyActive = !!(latest && latest.isCurrentlyActive());

  return {
    active: active.length > 0,
    plan: currentlyActive ? latest.planName || PLAN_NAME : 'Free',
    category: currentlyActive ? latest.category || 'all' : null,
    status: latest ? latest.status : 'none',
    price: currentlyActive ? latest.price ?? defaultPrice : defaultPrice,
    currency: 'INR',
    durationDays: PLAN_DURATION_DAYS,
    startDate: currentlyActive ? latest.purchaseDate || latest.createdAt || null : null,
    expiryDate: currentlyActive ? latest.expiryDate || null : latest?.expiryDate || null,
    remainingDays: currentlyActive ? remainingDays(latest.expiryDate) : 0,
    transactionId: currentlyActive ? latest.transactionId || latest.razorpayPaymentId || null : null,
    couponCode: currentlyActive ? latest.couponCode || null : null,
    originalPrice: currentlyActive ? latest.originalPrice ?? latest.price : null,
    discountAmount: currentlyActive ? latest.discountAmount || 0 : 0,
    razorpayConfigured: razorpayService.isRazorpayConfigured(),
    plans: plans.map(formatPlan),
    access,
    activeSubscriptions: active.map((sub) => ({
      category: sub.category,
      planName: sub.planName,
      expiryDate: sub.expiryDate,
      remainingDays: remainingDays(sub.expiryDate),
      price: sub.price,
    })),
  };
}

async function createCheckoutOrder(user, { category, couponCode } = {}) {
  const slug = String(category || '').trim().toLowerCase();
  if (!planService.CATEGORIES.includes(slug)) {
    throw new ApiError(400, 'Choose Beginner, Intermediate, or Advanced.');
  }

  const quote = await quotePurchase(slug, couponCode);
  if (quote.finalPrice < 1) {
    throw new ApiError(400, 'Payable amount is too low to checkout.');
  }

  const userId = user._id;
  const receipt = `${slug.slice(0, 4)}_${String(userId).slice(-8)}_${Date.now().toString(36)}`;

  const order = await razorpayService.createOrder({
    amountInr: quote.finalPrice,
    receipt,
    notes: {
      userId: String(userId),
      category: slug,
      couponCode: quote.couponCode || '',
      originalPrice: String(quote.originalPrice),
      finalPrice: String(quote.finalPrice),
    },
  });

  try {
    await CheckoutSession.create({
      user: userId,
      razorpayOrderId: order.orderId,
      category: slug,
      couponCode: quote.couponCode,
      durationDays: quote.durationDays || PLAN_DURATION_DAYS,
      originalPrice: quote.originalPrice,
      discountAmount: quote.discountAmount,
      finalPrice: quote.finalPrice,
      status: 'pending',
    });
  } catch (err) {
    console.error('Checkout session save failed after Razorpay order:', err.message || err);
    throw new ApiError(500, 'Could not start checkout. Please try again.');
  }

  return {
    ...order,
    planName: quote.title,
    planPrice: quote.finalPrice,
    originalPrice: quote.originalPrice,
    discountAmount: quote.discountAmount,
    finalPrice: quote.finalPrice,
    couponCode: quote.couponCode,
    couponApplied: quote.couponApplied,
    category: slug,
    durationDays: quote.durationDays,
    description: `${quote.title} Subscription — ${quote.durationDays} days`,
    name: "Ohm's English",
    prefill: {
      name: user.name || '',
      email: user.email || '',
      contact: user.phone || '',
    },
    themeColor: '#e60000',
  };
}

async function findSubscriptionByPaymentRefs({ paymentId, orderId }) {
  if (paymentId) {
    const byPayment = await Subscription.findOne({ razorpayPaymentId: paymentId });
    if (byPayment) return byPayment;
  }
  if (orderId) {
    return Subscription.findOne({ razorpayOrderId: orderId, paymentStatus: 'completed' }).sort({ createdAt: -1 });
  }
  return null;
}

async function claimCouponUsage(session) {
  if (!session?.couponCode) return;
  const claimed = await CheckoutSession.findOneAndUpdate(
    { _id: session._id, couponIncremented: { $ne: true } },
    { $set: { couponIncremented: true } },
    { new: false }
  );
  if (claimed && !claimed.couponIncremented) {
    await couponService.incrementUsage(session.couponCode);
  }
}

async function activatePaidCheckout(session, { paymentId, signature }) {
  const existing = await findSubscriptionByPaymentRefs({
    paymentId,
    orderId: session.razorpayOrderId,
  });
  if (existing) {
    if (session.status !== 'paid') {
      session.status = 'paid';
      await session.save();
    }
    await claimCouponUsage(session);
    return existing;
  }

  const plan = await planService.getPlan(session.category);
  const durationDays = session.durationDays || plan?.durationDays || PLAN_DURATION_DAYS;
  const now = Date.now();
  const existingActive = await Subscription.findOne({
    user: session.user,
    status: 'active',
    category: { $in: [session.category, 'all'] },
    expiryDate: { $gt: new Date() },
  }).sort({ expiryDate: -1 });

  const base = existingActive?.expiryDate?.getTime() > now ? existingActive.expiryDate.getTime() : now;
  const expiryDate = new Date(base + durationDays * DAY_MS);

  let subscription;
  try {
    subscription = await Subscription.create({
      user: session.user,
      planName: plan?.title || session.category,
      category: session.category,
      price: session.finalPrice,
      originalPrice: session.originalPrice,
      discountAmount: session.discountAmount,
      couponCode: session.couponCode,
      currency: 'INR',
      purchaseDate: new Date(now),
      expiryDate,
      status: 'active',
      paymentStatus: 'completed',
      transactionId: paymentId,
      razorpayOrderId: session.razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature || '',
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dup = await findSubscriptionByPaymentRefs({
        paymentId,
        orderId: session.razorpayOrderId,
      });
      if (dup) return dup;
    }
    throw err;
  }

  session.status = 'paid';
  await session.save();
  await claimCouponUsage(session);

  try {
    const notificationService = require('./notificationService');
    await notificationService.notifySubscriptionActivated(session.user, {
      expiryDate,
      planName: subscription.planName,
      category: session.category,
    });
  } catch (err) {
    console.error('Subscription notification failed:', err.message || err);
  }

  (async () => {
    try {
      const User = require('../models/User');
      const emailService = require('./emailService');
      const user = await User.findById(session.user).select('name email phone').lean();
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

async function activateFromRazorpayPayment(userId, { orderId, paymentId, signature, source } = {}) {
  if (source !== 'webhook') {
    if (!razorpayService.verifyPaymentSignature({ orderId, paymentId, signature })) {
      throw new ApiError(400, 'Payment verification failed. Invalid Razorpay signature.');
    }
  }

  const existingPayment = await findSubscriptionByPaymentRefs({ paymentId, orderId });
  if (existingPayment) {
    if (userId && String(existingPayment.user) !== String(userId)) {
      throw new ApiError(403, 'This payment belongs to another account.');
    }
    return existingPayment;
  }

  const sessionQuery = userId
    ? { razorpayOrderId: orderId, user: userId }
    : { razorpayOrderId: orderId };
  const session = await CheckoutSession.findOne(sessionQuery);
  if (!session) {
    throw new ApiError(400, 'Checkout session not found. Please start payment again.');
  }
  if (userId && String(session.user) !== String(userId)) {
    throw new ApiError(403, 'This payment belongs to another account.');
  }

  return activatePaidCheckout(session, { paymentId, signature });
}

async function activateFromRazorpayWebhook({ orderId, paymentId, amountPaise }) {
  const session = await CheckoutSession.findOne({ razorpayOrderId: orderId });
  if (!session) return null;

  const expectedPaise = Math.round(Number(session.finalPrice) * 100);
  if (Number.isFinite(amountPaise) && expectedPaise > 0 && Number(amountPaise) !== expectedPaise) {
    console.error(
      `[Razorpay webhook] Amount mismatch for ${orderId}: got ${amountPaise}, expected ${expectedPaise}`
    );
    return null;
  }

  return activateFromRazorpayPayment(session.user, {
    orderId,
    paymentId,
    source: 'webhook',
  });
}

module.exports = {
  PLAN_PRICE,
  PLAN_NAME,
  PLAN_DURATION_DAYS,
  getLatestSubscription,
  listActiveSubscriptions,
  hasActiveSubscription,
  hasAccessToCategory,
  getSubscriptionSummary,
  quotePurchase,
  createCheckoutOrder,
  activateFromRazorpayPayment,
  activateFromRazorpayWebhook,
};
