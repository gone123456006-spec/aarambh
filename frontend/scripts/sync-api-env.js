/**
 * Updates EXPO_PUBLIC_API_URL (LAN) in frontend/.env.
 * Preserves EXPO_PUBLIC_REMOTE_API_URL — use that for 2+ phones on Expo tunnel / different networks.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function pickLanIpv4() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    const lower = name.toLowerCase();
    if (lower.includes('vethernet') || lower.includes('virtual') || lower.includes('loopback')) {
      continue;
    }
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      candidates.push({ name, address: addr.address });
    }
  }

  const preferred = candidates.find((c) =>
    /^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^10\./.test(c.address)
  );
  return preferred?.address ?? candidates[0]?.address ?? null;
}

function parseEnv(content) {
  const map = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return map;
}

const ip = pickLanIpv4();
const port = process.env.EXPO_PUBLIC_API_PORT || '5000';
const envPath = path.join(__dirname, '..', '.env');

const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const vars = parseEnv(existing);

if (!ip) {
  console.warn('[sync-api-env] No LAN IPv4 found. Set EXPO_PUBLIC_API_URL manually.');
  process.exit(0);
}

vars.EXPO_PUBLIC_API_URL = `http://${ip}:${port}`;
vars.EXPO_PUBLIC_API_PORT = port;

const lines = [
  '# Auto-generated LAN API (PC on same Wi‑Fi as phones).',
  '# For 2 phones on Expo tunnel / different networks, set EXPO_PUBLIC_REMOTE_API_URL (see .env.example).',
];

if (vars.EXPO_PUBLIC_REMOTE_API_URL) {
  lines.push(`EXPO_PUBLIC_REMOTE_API_URL=${vars.EXPO_PUBLIC_REMOTE_API_URL}`);
}
lines.push(`EXPO_PUBLIC_API_URL=${vars.EXPO_PUBLIC_API_URL}`);
lines.push(`EXPO_PUBLIC_API_PORT=${vars.EXPO_PUBLIC_API_PORT}`);
lines.push('');

fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
console.log(`[sync-api-env] LAN API → ${vars.EXPO_PUBLIC_API_URL}`);
if (vars.EXPO_PUBLIC_REMOTE_API_URL) {
  console.log(`[sync-api-env] Remote API (used by app) → ${vars.EXPO_PUBLIC_REMOTE_API_URL}`);
}
