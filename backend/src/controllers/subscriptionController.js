const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const subscriptionService = require('../services/subscriptionService');
const razorpayService = require('../services/razorpayService');

const getMySubscription = asyncHandler(async (req, res) => {
  const summary = await subscriptionService.getSubscriptionSummary(req.user._id);
  res.status(200).json(new ApiResponse(200, summary, 'Subscription status retrieved successfully'));
});

const getPlans = asyncHandler(async (req, res) => {
  const summary = await subscriptionService.getSubscriptionSummary(req.user._id);
  res.status(200).json(
    new ApiResponse(200, { plans: summary.plans, access: summary.access }, 'Subscription plans retrieved')
  );
});

const previewCheckout = asyncHandler(async (req, res) => {
  const quote = await subscriptionService.quotePurchase(req.body?.category, req.body?.couponCode);
  res.status(200).json(new ApiResponse(200, quote, 'Checkout preview ready'));
});

const createOrder = asyncHandler(async (req, res) => {
  const order = await subscriptionService.createCheckoutOrder(req.user, {
    category: req.body?.category,
    couponCode: req.body?.couponCode,
  });
  res.status(201).json(new ApiResponse(201, order, 'Razorpay order created successfully'));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body || {};

  await subscriptionService.activateFromRazorpayPayment(req.user._id, {
    orderId,
    paymentId,
    signature,
  });

  const summary = await subscriptionService.getSubscriptionSummary(req.user._id);
  res.status(201).json(new ApiResponse(201, summary, 'Subscription activated successfully'));
});

/** Razorpay server-to-server backup if the app closes after payment. */
const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  if (!razorpayService.isWebhookConfigured()) {
    return res.status(200).json({ success: true, ignored: true });
  }

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;
  if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
    throw new ApiError(400, 'Invalid Razorpay webhook signature');
  }

  let event;
  try {
    event = Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString('utf8')) : rawBody;
  } catch {
    throw new ApiError(400, 'Invalid webhook payload');
  }

  const type = event?.event;
  if (type !== 'payment.captured' && type !== 'order.paid') {
    return res.status(200).json({ success: true, ignored: true });
  }

  const payment = event?.payload?.payment?.entity || {};
  const orderId = payment.order_id || event?.payload?.order?.entity?.id;
  const paymentId = payment.id;
  const amountPaise = payment.amount;

  if (!orderId || !paymentId) {
    return res.status(200).json({ success: true, ignored: true });
  }

  await subscriptionService.activateFromRazorpayWebhook({ orderId, paymentId, amountPaise });
  res.status(200).json({ success: true });
});

module.exports = {
  getMySubscription,
  getPlans,
  previewCheckout,
  createOrder,
  verifyPayment,
  handleRazorpayWebhook,
};
