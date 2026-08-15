require('dotenv').config();
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function tokenKind(token) {
  if (!token) return 'empty';
  if (token.startsWith('ExponentPushToken')) return 'expo-push-token';
  if (token.length > 80 && !token.includes(' ')) return 'likely-fcm';
  return 'unknown';
}

async function main() {
  const report = [];
  const ok = (msg) => report.push(`PASS  ${msg}`);
  const fail = (msg) => report.push(`FAIL  ${msg}`);
  const warn = (msg) => report.push(`WARN  ${msg}`);

  try {
    const health = await get('http://localhost:5000/health');
    if (health.status === 200) ok('Backend /health is UP');
    else fail(`Backend /health returned ${health.status}`);
  } catch (err) {
    fail(`Backend is not reachable: ${err.message}`);
  }

  const firebaseService = require('../src/services/firebaseService');
  const app = firebaseService.initializeFirebase();
  if (app || firebaseService.isFirebaseEnabled()) ok('Firebase Admin initialized');
  else fail('Firebase Admin is NOT initialized');

  const connectDB = require('../src/config/db');
  await connectDB();
  const DeviceToken = require('../src/models/DeviceToken');
  const Notification = require('../src/models/Notification');

  const [totalTokens, activeTokens, sent] = await Promise.all([
    DeviceToken.countDocuments(),
    DeviceToken.countDocuments({ isActive: true }),
    Notification.countDocuments(),
  ]);
  ok(`Device tokens: ${totalTokens} total, ${activeTokens} active`);
  ok(`Push history records: ${sent}`);

  const samples = await DeviceToken.find({ isActive: true })
    .sort({ updatedAt: -1 })
    .limit(8)
    .select('token deviceInfo isActive updatedAt userId')
    .lean();

  const kinds = { 'expo-push-token': 0, 'likely-fcm': 0, unknown: 0, empty: 0 };
  for (const row of samples) kinds[tokenKind(row.token)] += 1;

  if (samples.length === 0) {
    warn('No active device tokens. Open the app on a phone while logged in.');
  } else {
    report.push(`INFO  Latest tokens (${samples.length}):`);
    for (const row of samples) {
      const kind = tokenKind(row.token);
      report.push(
        `      ${kind}  ${row.deviceInfo?.platform || '?'}  ${String(row.token).slice(0, 22)}…`
      );
    }
    if (kinds['expo-push-token'] > 0 && kinds['likely-fcm'] === 0) {
      fail(
        'Stored tokens are Expo push tokens. Firebase FCM cannot deliver those. Need native FCM tokens from a dev/production build.'
      );
    } else if (kinds['likely-fcm'] > 0) {
      ok('Stored tokens look like native FCM tokens');
    }
  }

  const mongoose = require('mongoose');
  await mongoose.disconnect();
  console.log('\n=== Push notification live check ===\n');
  console.log(report.join('\n'));
  console.log('');
}

main().catch((err) => {
  console.error('Check failed:', err.message);
  process.exit(1);
});
