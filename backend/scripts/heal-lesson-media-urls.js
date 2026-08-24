/**
 * One-shot: point broken / missing lesson media at playable remote URLs.
 * Usage (from backend/): node scripts/heal-lesson-media-urls.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const HEAL_VIDEO =
  process.env.MEDIA_HEAL_VIDEO_URL ||
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const HEAL_PDF =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

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

function needsHeal(url) {
  const v = String(url || '').trim();
  if (!v) return true;
  if (/localhost|127\.0\.0\.1/i.test(v)) return true;
  if (/\/uploads\//i.test(v)) return true;
  return false;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
    console.log('Connected via MONGODB_URI');
  } catch (err) {
    console.warn('SRV connect failed:', err.message);
    const direct = buildDirectUri(uri);
    if (!direct) throw err;
    await mongoose.connect(direct, { serverSelectionTimeoutMS: 30000 });
    console.log('Connected via direct hosts');
  }

  const col = mongoose.connection.db.collection('courses');
  const courses = await col.find({}).toArray();
  let changed = 0;

  for (const course of courses) {
    let dirty = false;
    for (const lesson of course.lessons || []) {
      if (needsHeal(lesson.videoUrl)) {
        lesson.videoUrl = HEAL_VIDEO;
        lesson.videoAvailableAt = new Date();
        dirty = true;
        changed += 1;
      }
      if (needsHeal(lesson.pdfUrl)) {
        lesson.pdfUrl = HEAL_PDF;
        lesson.pdfAvailableAt = new Date();
        dirty = true;
        changed += 1;
      }
      console.log(
        JSON.stringify({
          course: course.level,
          title: lesson.title,
          videoUrl: lesson.videoUrl,
          pdfUrl: lesson.pdfUrl,
        })
      );
    }
    if (dirty) {
      await col.updateOne({ _id: course._id }, { $set: { lessons: course.lessons } });
      console.log('Updated course', course.level);
    }
  }

  console.log('DONE healed fields:', changed);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
