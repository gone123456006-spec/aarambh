/**
 * CORS / Socket.io origin policy.
 * Mobile apps (Expo) often send no Origin — use CLIENT_URL=* in production on Render.
 */

function resolveCorsOrigin() {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const clientUrl = process.env.CLIENT_URL?.trim();

  if (!clientUrl || clientUrl === '*') {
    return true;
  }

  if (clientUrl.includes(',')) {
    return clientUrl.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return clientUrl;
}

function getCorsOptions() {
  return {
    origin: resolveCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

module.exports = {
  resolveCorsOrigin,
  getCorsOptions,
};
