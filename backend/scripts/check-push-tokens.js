require('dotenv').config();
const mongoose = require('mongoose');

const SHARDS = [
  'ac-2kgrnvw-shard-00-00.gd5heqm.mongodb.net:27017',
  'ac-2kgrnvw-shard-00-01.gd5heqm.mongodb.net:27017',
  'ac-2kgrnvw-shard-00-02.gd5heqm.mongodb.net:27017',
];

function buildDirectUri(srvUri) {
  const m = String(srvUri || '').match(
    /^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/i
  );
  if (!m) return null;
  const [, user, pass, , dbName] = m;
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${SHARDS.join(',')}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;
}

(async () => {
  const uri = process.env.MONGODB_URI;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
  } catch {
    await mongoose.connect(buildDirectUri(uri), { serverSelectionTimeoutMS: 30000 });
  }

  const col = mongoose.connection.db.collection('devicetokens');
  const total = await col.countDocuments({});
  const active = await col.countDocuments({ isActive: true });
  const fcm = await col.countDocuments({ isActive: true, tokenType: 'fcm' });
  const expo = await col.countDocuments({ isActive: true, tokenType: 'expo' });
  const expoPrefix = await col.countDocuments({
    isActive: true,
    token: { $regex: '^ExponentPushToken' },
  });
  const recent = await col
    .find({ isActive: true })
    .project({ tokenType: 1, lastUsedAt: 1, updatedAt: 1, 'deviceInfo.platform': 1 })
    .sort({ updatedAt: -1 })
    .limit(5)
    .toArray();

  console.log(JSON.stringify({ total, active, fcm, expo, expoPrefix, recent }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
