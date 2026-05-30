const http = require('http');
const https = require('https');

const DEFAULT_PUBLIC_API = 'https://aarambh-api.onrender.com';
const HEALTH_PATH = '/health';
const PING_TIMEOUT_MS = 15000;
const DEFAULT_INTERVAL_MS = 60 * 1000;
const MIN_INTERVAL_MS = 30 * 1000;

function getPingIntervalMs() {
  const raw = Number(process.env.KEEP_ALIVE_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < MIN_INTERVAL_MS) {
    return DEFAULT_INTERVAL_MS;
  }
  return raw;
}

/**
 * Resolve the URL used for self-ping (public HTTPS URL — required for Render free tier).
 */
function resolvePingUrl() {
  const base =
    process.env.KEEP_ALIVE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_URL ||
    '';

  if (base) {
    return `${base.replace(/\/$/, '')}${HEALTH_PATH}`;
  }

  if (process.env.NODE_ENV === 'production') {
    return `${DEFAULT_PUBLIC_API}${HEALTH_PATH}`;
  }

  return null;
}

function shouldEnableKeepAlive() {
  if (process.env.KEEP_ALIVE_ENABLED === 'false') return false;
  if (process.env.KEEP_ALIVE_ENABLED === 'true') return true;
  if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID) return true;
  return process.env.NODE_ENV === 'production';
}

function pingOnce(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, { timeout: PING_TIMEOUT_MS }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Sends periodic GET /health requests so Render (and similar hosts) do not idle-spin down.
 */
function startKeepAlive() {
  if (!shouldEnableKeepAlive()) {
    console.log('[keep-alive] disabled (set KEEP_ALIVE_ENABLED=true on Render to enable)');
    return null;
  }

  const url = resolvePingUrl();
  if (!url) {
    console.warn('[keep-alive] no public URL — set KEEP_ALIVE_URL or RENDER_EXTERNAL_URL');
    return null;
  }

  const intervalMs = getPingIntervalMs();
  let failStreak = 0;

  const runPing = async () => {
    const ok = await pingOnce(url);
    if (ok) {
      failStreak = 0;
      return;
    }
    failStreak += 1;
    if (failStreak === 1 || failStreak % 5 === 0) {
      console.warn(`[keep-alive] ping failed (${failStreak}x) → ${url}`);
    }
  };

  runPing();

  const timer = setInterval(runPing, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  console.log(
    `[keep-alive] active — pinging every ${intervalMs / 1000}s → ${url}`
  );

  return timer;
}

function stopKeepAlive(timer) {
  if (timer) {
    clearInterval(timer);
  }
}

module.exports = {
  startKeepAlive,
  stopKeepAlive,
  PING_INTERVAL_MS: DEFAULT_INTERVAL_MS,
  getPingIntervalMs,
};
