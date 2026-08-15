const Razorpay = require('razorpay');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

let razorpayClient = null;

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return { keyId, keySecret };
}

function isRazorpayConfigured() {
  const { keyId, keySecret } = getRazorpayCredentials();
  return Boolean(keyId && keySecret);
}

function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    throw new ApiError(
      503,
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.'
    );
  }

  if (!razorpayClient) {
    const { keyId, keySecret } = getRazorpayCredentials();
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return razorpayClient;
}

/**
 * Create a Razorpay order for the Pro plan.
 * Amount is always in paise (₹249 → 24900).
 */
async function createOrder({ amountInr, receipt, notes = {} }) {
  const client = getRazorpayClient();
  const amountPaise = Math.round(Number(amountInr) * 100);

  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    throw new ApiError(400, 'Invalid payment amount');
  }

  const order = await client.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
    notes,
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: getRazorpayCredentials().keyId,
  };
}

/**
 * Verify that the checkout callback signature was signed with our secret.
 * generated_signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const { keySecret } = getRazorpayCredentials();
  if (!keySecret) return false;

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isWebhookConfigured() {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim());
}

/** Razorpay webhook HMAC of the raw request body. */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature || rawBody == null) return false;

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = {
  isRazorpayConfigured,
  isWebhookConfigured,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  getRazorpayCredentials,
};
