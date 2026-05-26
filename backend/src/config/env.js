/**
 * Environment validation and shared config for local + Render production.
 */

const REQUIRED_ALWAYS = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const REQUIRED_PRODUCTION = ['SMTP_USER', 'SMTP_PASS'];

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isRender() {
  return process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID);
}

function getMissing(keys) {
  return keys.filter((key) => !process.env[key]?.trim());
}

function validateEnv() {
  const missing = getMissing(REQUIRED_ALWAYS);

  if (isProduction()) {
    missing.push(...getMissing(REQUIRED_PRODUCTION));
  }

  if (missing.length > 0) {
    console.error(
      `[env] Missing required variable(s): ${[...new Set(missing)].join(', ')}`
    );
    console.error(
      '[env] Copy backend/.env.render.example → set values in Render Dashboard → Environment.'
    );
    process.exit(1);
  }

  if (isProduction() && !isRender() && !process.env.PORT) {
    console.warn('[env] PORT is not set; defaulting to 5000 (Render sets PORT automatically).');
  }
}

function getPublicBaseUrl() {
  const base =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_URL ||
    process.env.KEEP_ALIVE_URL ||
    '';

  return base.replace(/\/$/, '');
}

module.exports = {
  validateEnv,
  isProduction,
  isRender,
  getPublicBaseUrl,
  REQUIRED_ALWAYS,
  REQUIRED_PRODUCTION,
};
