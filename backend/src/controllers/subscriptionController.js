const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const subscriptionService = require('../services/subscriptionService');

/** GET /api/subscription/me — current subscription status for the signed-in user. */
const getMySubscription = asyncHandler(async (req, res) => {
  const summary = await subscriptionService.getSubscriptionSummary(req.user._id);
  res.status(200).json(new ApiResponse(200, summary, 'Subscription status retrieved successfully'));
});

/** POST /api/subscription/create-order — create a Razorpay order for Pro checkout. */
const createOrder = asyncHandler(async (req, res) => {
  const order = await subscriptionService.createCheckoutOrder(req.user);
  res.status(201).json(new ApiResponse(201, order, 'Razorpay order created successfully'));
});

/**
 * POST /api/subscription/verify-payment — verify Razorpay signature and activate Pro.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
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
  res.status(201).json(new ApiResponse(201, summary, 'Pro subscription activated successfully'));
});

module.exports = {
  getMySubscription,
  createOrder,
  verifyPayment,
};
