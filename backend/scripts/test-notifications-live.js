require('dotenv').config();
const connectDB = require('../src/config/db');
const firebaseService = require('../src/services/firebaseService');
const DeviceToken = require('../src/models/DeviceToken');
const InAppNotification = require('../src/models/InAppNotification');
const User = require('../src/models/User');

function tokenKind(token) {
  if (!token) return 'empty';
  if (String(token).startsWith('ExponentPushToken')) return 'expo';
  if (String(token).length > 80) return 'fcm';
  return 'unknown';
}

async function main() {
  const report = [];
  const pass = (msg) => report.push(`PASS  ${msg}`);
  const fail = (msg) => report.push(`FAIL  ${msg}`);
  const info = (msg) => report.push(`INFO  ${msg}`);

  await connectDB();

  const app = firebaseService.initializeFirebase();
  if (app || firebaseService.isFirebaseEnabled()) pass('Firebase Admin initialized');
  else fail('Firebase Admin is NOT initialized — production phones will not get FCM');

  const [users, tokens, inApp] = await Promise.all([
    User.countDocuments({ role: { $ne: 'admin' } }),
    DeviceToken.find({ isActive: true }).select('token userId deviceInfo').lean(),
    InAppNotification.countDocuments(),
  ]);
  pass(`Users (non-admin): ${users}`);
  pass(`Active device tokens: ${tokens.length}`);
  pass(`In-app notifications in DB: ${inApp}`);

  const kinds = { expo: 0, fcm: 0, unknown: 0 };
  for (const row of tokens) kinds[tokenKind(row.token)] += 1;
  info(`Token mix: expo=${kinds.expo} fcm=${kinds.fcm} unknown=${kinds.unknown}`);

  const testUser = await User.findOne({ role: { $ne: 'admin' } }).sort({ lastSeen: -1 });
  if (!testUser) {
    fail('No user found to test in-app notifications');
  } else {
    const created = await firebaseService.fanoutInAppNotifications({
      title: 'In-app test',
      body: 'Bell notifications are working.',
      data: { type: 'system' },
      targetType: 'specific',
      targetUserIds: [testUser._id],
    });
    if (created > 0) pass(`Created in-app notification for ${testUser.email}`);
    else fail('Could not create in-app notification');

    const latest = await InAppNotification.findOne({ user: testUser._id }).sort({ createdAt: -1 }).lean();
    if (latest?.title === 'In-app test') pass('In-app notification stored and readable');
    else fail('In-app notification not found after create');
  }

  if (tokens.length) {
    const sample = tokens.slice(0, 3);
    const result = await firebaseService.sendToTokens(
      sample.map((t) => t.token),
      { title: 'Ohm\'s test', body: 'Push delivery check' },
      { type: 'system' }
    );
    info(`Push sample send: success=${result.successCount} fail=${result.failureCount}`);
    if (result.successCount > 0) pass('At least one push token accepted');
    else fail('No push tokens accepted — check Firebase key on Render for real phones');
  } else {
    fail('No active device tokens. Open the Play Store / installed app while logged in.');
  }

  const mongoose = require('mongoose');
  await mongoose.disconnect();
  console.log('\n=== Notification test ===\n');
  console.log(report.join('\n'));
  console.log('');
  if (report.some((line) => line.startsWith('FAIL'))) process.exit(1);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
