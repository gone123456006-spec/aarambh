const http = require('http');
const https = require('https');

const PING_INTERVAL_MS = 60 * 1000;
const HEALTH_PATH = '/health';
const PING_TIMEOUT_MS = 15000;

/**
 * Resolve the URL used for self-ping (Render public URL preferred).
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
    const port = process.env.PORT || 5000;
    return `http://127.0.0.1:${port}${HEALTH_PATH}`;
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
 * Does not alter routes, sockets, or other application logic.
 */
function startKeepAlive() {
  if (!shouldEnableKeepAlive()) return null;

  const url = resolvePingUrl();
  if (!url) return null;

  const runPing = async () => {
    const ok = await pingOnce(url);
    if (!ok) {
      console.warn(`[keep-alive] ping failed → ${url}`);
    }
  };

  runPing();

  const timer = setInterval(runPing, PING_INTERVAL_MS);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  console.log(
    `[keep-alive] active — pinging every ${PING_INTERVAL_MS / 1000}s → ${url}`
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
  PING_INTERVAL_MS,
};
