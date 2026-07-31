/**
 * Ensure private user data is correctly owned and indexed.
 *
 * Usage (from backend/):
 *   npm run migrate:user-isolation
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { resolveMongoUri } = require('../src/config/resolveMongoUri');

async function run() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  const uri = await resolveMongoUri(rawUri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const User = db.collection('users');
  const CourseProgress = db.collection('courseprogresses');
  const GameProgress = db.collection('gameprogresses');
  const Notifications = db.collection('notifications');
  const Messages = db.collection('messages');
  const ChatSessions = db.collection('chatsessions');

  const userIds = new Set(
    (await User.find({}, { projection: { _id: 1 } }).toArray()).map((u) => String(u._id))
  );

  const orphanFilter = (doc) => !doc.user || !userIds.has(String(doc.user));

  const courseOrphans = (await CourseProgress.find({}).toArray()).filter(orphanFilter);
  const gameOrphans = (await GameProgress.find({}).toArray()).filter(orphanFilter);
  const notifOrphans = (await Notifications.find({}).toArray()).filter(orphanFilter);

  if (courseOrphans.length) {
    await CourseProgress.deleteMany({
      _id: { $in: courseOrphans.map((d) => d._id) },
    });
  }
  if (gameOrphans.length) {
    await GameProgress.deleteMany({
      _id: { $in: gameOrphans.map((d) => d._id) },
    });
  }
  if (notifOrphans.length) {
    await Notifications.deleteMany({
      _id: { $in: notifOrphans.map((d) => d._id) },
    });
  }

  const validObjectIds = [...userIds].map((id) => new mongoose.Types.ObjectId(id));
  const messageOrphans = await Messages.find({
    sender: { $nin: validObjectIds },
  }).toArray();
  if (messageOrphans.length) {
    await Messages.deleteMany({
      _id: { $in: messageOrphans.map((d) => d._id) },
    });
  }

  const sessions = await ChatSessions.find({}).toArray();
  let endedBroken = 0;
  for (const session of sessions) {
    const valid = (session.participants || []).filter((p) => userIds.has(String(p)));
    if (valid.length < 2 && session.status === 'active') {
      await ChatSessions.updateOne(
        { _id: session._id },
        { $set: { status: 'ended', endedAt: new Date() } }
      );
      endedBroken += 1;
    }
  }

  await CourseProgress.createIndex({ user: 1 }, { unique: true });
  await GameProgress.createIndex({ user: 1, gameId: 1 }, { unique: true });
  await GameProgress.createIndex({ user: 1 });
  await Notifications.createIndex({ user: 1, read: 1 });
  await Messages.createIndex({ sender: 1, createdAt: -1 });
  await Messages.createIndex({ chatSession: 1, timestamp: 1 });
  await ChatSessions.createIndex({ participants: 1, status: 1 });
  await ChatSessions.createIndex({ participants: 1, startedAt: -1 });
  await User.createIndex({ totalPoints: -1, createdAt: 1 });

  console.log(
    JSON.stringify(
      {
        removedCourseProgress: courseOrphans.length,
        removedGameProgress: gameOrphans.length,
        removedNotifications: notifOrphans.length,
        removedMessages: messageOrphans.length,
        endedBrokenSessions: endedBroken,
        indexes: 'ensured',
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
