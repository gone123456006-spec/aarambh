const rateLimit = require('express-rate-limit');

function hasBearerAuth(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  return typeof header === 'string' && header.startsWith('Bearer ');
}

/** Skip global API limit for admin tools and signed-in app users. */
function shouldSkipApiRateLimit(req) {
  const path = String(req.path || '');
  const url = String(req.originalUrl || '');
  if (path.startsWith('/admin') || url.includes('/api/admin')) return true;
  if (hasBearerAuth(req)) return true;
  return false;
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipApiRateLimit,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests. Please wait 1 minute and try again.',
  },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many login attempts. Please try again after 1 minute.',
  },
});

const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many coupon attempts. Please wait 1 minute and try again.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  couponLimiter,
  shouldSkipApiRateLimit,
};
