/**
 * Production: canonicalize lesson media URLs and report GridFS gaps.
 * Does NOT inject sample Google videos.
 *
 * Usage (from backend/):
 *   node scripts/heal-lesson-media-urls.js
 */
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
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`;
  return `mongodb://${auth}@${SHARDS.join(',')}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
  } catch (err) {
    const direct = buildDirectUri(uri);
    if (!direct) throw err;
    await mongoose.connect(direct, { serverSelectionTimeoutMS: 30000 });
  }

  const {
    initMediaStore,
    healMissingLessonMedia,
    mediaStats,
  } = require('../src/config/gridfsMedia');

  await initMediaStore();
  const healed = await healMissingLessonMedia();
  console.log('Repair result:', healed);
  console.log('Media stats:', mediaStats());
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
