const ChatSession = require('../models/ChatSession');
const User = require('../models/User');

const LEVEL_LABELS = {
  starting: 'Starting',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

// In-memory pools for quick matchmaking and socket referencing
const waitingPool = new Map(); // userId -> peer snapshot from DB
const activeConnections = new Map(); // userId -> socketId

const toPeerProfile = (user) => {
  const id = user._id.toString();
  const levelKey = user.level || '';
  return {
    id,
    name: (user.name && user.name.trim()) || 'Learner',
    location: (user.region && user.region.trim()) || 'Not set',
    region: (user.region && user.region.trim()) || 'Not set',
    gender: user.gender || '',
    level: LEVEL_LABELS[levelKey] || levelKey || '',
    avatar: (user.avatar && user.avatar.trim()) || '',
  };
};

/**
 * Add user to the general online socket registry
 */
const registerOnlineUser = (userId, socketId) => {
  activeConnections.set(userId.toString(), socketId);
};

/**
 * Remove user from online socket registry
 */
const unregisterOnlineUser = (userId) => {
  activeConnections.delete(userId.toString());
  waitingPool.delete(userId.toString());
};

/**
 * Get socket ID of an online user
 */
const getSocketIdByUserId = (userId) => {
  return activeConnections.get(userId.toString());
};

/**
 * Add a user to the matching waiting pool
 */
const addToWaitingPool = async (userId, socketId) => {
  const user = await User.findById(userId).select('name region gender level avatar');
  if (!user) return;

  waitingPool.set(userId.toString(), {
    socketId,
    userId: userId.toString(),
    ...toPeerProfile(user),
  });
};

/**
 * Latest profile from DB (same fields as /api/users/me & app profile screen).
 */
const getPeerProfile = async (userId) => {
  const user = await User.findById(userId).select('name region gender level avatar');
  if (!user) return null;
  return toPeerProfile(user);
};

/**
 * Remove a user from the waiting pool
 */
const removeFromWaitingPool = (userId) => {
  waitingPool.delete(userId.toString());
};

/**
 * Find a random peer from the waiting pool
 */
const findRandomMatch = (userId) => {
  const myIdStr = userId.toString();
  const candidates = Array.from(waitingPool.keys()).filter(id => id !== myIdStr);

  if (candidates.length === 0) {
    return null;
  }

  // Pick a random candidates index
  const randomIdx = Math.floor(Math.random() * candidates.length);
  const matchUserId = candidates[randomIdx];

  const entry = waitingPool.get(matchUserId);
  return entry ? { userId: matchUserId, ...entry } : null;
};

/**
 * Start a database session for two matched users
 */
const createSession = async (user1Id, user2Id) => {
  // End any previously active sessions for both users to prevent duplicate/multi-sessions
  await ChatSession.updateMany(
    {
      participants: { $in: [user1Id, user2Id] },
      status: 'active',
    },
    {
      $set: { status: 'ended', endedAt: new Date() },
    }
  );

  const newSession = new ChatSession({
    participants: [user1Id, user2Id],
    status: 'active',
    startedAt: new Date(),
  });

  await newSession.save();
  return newSession;
};

/**
 * Terminate an active chat session
 */
const endSession = async (sessionId) => {
  const session = await ChatSession.findById(sessionId);
  if (session && session.status === 'active') {
    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();
  }
  return session;
};

module.exports = {
  registerOnlineUser,
  unregisterOnlineUser,
  getSocketIdByUserId,
  addToWaitingPool,
  removeFromWaitingPool,
  findRandomMatch,
  getPeerProfile,
  createSession,
  endSession,
  waitingPool,
};
