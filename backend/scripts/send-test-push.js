require('dotenv').config();
const connectDB = require('../src/config/db');
const firebaseService = require('../src/services/firebaseService');
const DeviceToken = require('../src/models/DeviceToken');
const mongoose = require('mongoose');

async function main() {
  firebaseService.initializeFirebase();
  await connectDB();

  const tokens = await DeviceToken.find({ isActive: true }).select('token deviceInfo').lean();
  if (!tokens.length) {
    console.log('No active device tokens to test.');
    await mongoose.disconnect();
    return;
  }

  const result = await firebaseService.sendToTokens(
    tokens.map((t) => t.token),
    {
      title: "Ohm's test",
      body: 'If you see this, push notifications are working.',
    },
    { type: 'test' }
  );

  console.log('Send result:', result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
