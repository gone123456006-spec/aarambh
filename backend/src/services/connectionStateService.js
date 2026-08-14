const User = require('../models/User');
const ChatSession = require('../models/ChatSession');
const {
  CONNECTION_STATES,
  isBusyState,
  callModeToState,
} = require('../constants/connectionState');

/** In-memory snapshot for fast matchmaking checks (same process as waiting pool). */
const connectionMemory = new Map();

function idStr(value) {
  return value == null ? null : String(value);
}

function snapshotOf(userId) {
  return (
    connectionMemory.get(idStr(userId)) || {
      state: CONNECTION_STATES.AVAILABLE,
      sessionId: null,
      peerId: null,
    }
  );
}

function writeMemory(userId, snap) {
  const id = idStr(userId);
  if (!id) return snap;
  if (!snap || snap.state === CONNECTION_STATES.AVAILABLE) {
    connectionMemory.set(id, {
      state: CONNECTION_STATES.AVAILABLE,
      sessionId: null,
      peerId: null,
    });
    return connectionMemory.get(id);
  }
  connectionMemory.set(id, {
    state: snap.state,
    sessionId: idStr(snap.sessionId),
    peerId: idStr(snap.peerId),
  });
  return connectionMemory.get(id);
}

function isBusy(userId) {
  return isBusyState(snapshotOf(userId).state);
}

function getState(userId) {
  return snapshotOf(userId);
}

async function persist(userId, snap) {
  const payload = writeMemory(userId, snap);
  await User.findByIdAndUpdate(userId, {
    $set: {
      connectionState: payload.state,
      connectionSessionId: payload.sessionId,
      connectedWith: payload.peerId,
    },
  }).exec();
  return payload;
}

async function markAvailable(userId) {
  return persist(userId, {
    state: CONNECTION_STATES.AVAILABLE,
    sessionId: null,
    peerId: null,
  });
}

async function isBusyAsync(userId) {
  if (isBusy(userId)) return true;
  const user = await User.findById(userId).select('connectionState').lean();
  return isBusyState(user?.connectionState);
}

/**
 * Atomically claim a user for a session. Fails if they are busy in a different session.
 */
async function claimForSession(userId, { sessionId, peerId, state }) {
  const sid = idStr(sessionId);
  const nextState = state || CONNECTION_STATES.CHAT_CONNECTED;
  const current = snapshotOf(userId);
  if (isBusyState(current.state) && current.sessionId && current.sessionId !== sid) {
    return null;
  }

  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { connectionState: CONNECTION_STATES.AVAILABLE },
        { connectionState: { $exists: false } },
        { connectionState: null },
        { connectionSessionId: sid },
        { connectionSessionId: sessionId },
      ],
    },
    {
      $set: {
        connectionState: nextState,
        connectionSessionId: sid,
        connectedWith: peerId || null,
      },
    },
    { new: true }
  ).select('_id connectionState connectionSessionId connectedWith');

  if (!user) return null;

  return writeMemory(userId, {
    state: nextState,
    sessionId: sid,
    peerId,
  });
}

async function setSessionParticipants(userIds, { sessionId, state, peerByUser }) {
  const snaps = [];
  for (const uid of userIds) {
    const peerId = peerByUser ? peerByUser[idStr(uid)] : null;
    snaps.push(
      await persist(uid, {
        state,
        sessionId,
        peerId,
      })
    );
  }
  return snaps;
}

async function upgradeCall(sessionId, participantIds, mode) {
  const state = callModeToState(mode);
  const ids = (participantIds || []).map(idStr);
  for (const uid of ids) {
    const current = snapshotOf(uid);
    if (current.sessionId && current.sessionId !== idStr(sessionId)) continue;
    const peerId = ids.find((id) => id !== uid) || current.peerId;
    await persist(uid, { state, sessionId, peerId });
  }
}

async function downgradeToChat(sessionId, participantIds) {
  const ids = (participantIds || []).map(idStr);
  for (const uid of ids) {
    const current = snapshotOf(uid);
    if (current.sessionId && current.sessionId !== idStr(sessionId)) continue;
    const peerId = ids.find((id) => id !== uid) || current.peerId;
    await persist(uid, {
      state: CONNECTION_STATES.CHAT_CONNECTED,
      sessionId,
      peerId,
    });
  }
}

async function releaseSession(sessionId, participantIds) {
  const sid = idStr(sessionId);
  for (const uid of participantIds || []) {
    const current = snapshotOf(uid);
    if (!current.sessionId || current.sessionId === sid) {
      await markAvailable(uid);
    }
  }
}

function peerIdFromSession(session, userId) {
  return (session?.participants || [])
    .map(idStr)
    .find((id) => id && id !== idStr(userId)) || null;
}

/**
 * Restore memory from DB / active session. Clears stale busy flags.
 */
async function reconcileUser(userId) {
  const session = await ChatSession.findOne({
    participants: userId,
    status: 'active',
  });

  if (!session) {
    return markAvailable(userId);
  }

  const user = await User.findById(userId).select('connectionState').lean();
  let state = user?.connectionState;
  if (!isBusyState(state)) {
    state = CONNECTION_STATES.CHAT_CONNECTED;
  }

  return persist(userId, {
    state,
    sessionId: session._id,
    peerId: peerIdFromSession(session, userId),
  });
}

function emitToUser(io, userId, snap) {
  if (!io || !userId) return;
  const payload = snap || snapshotOf(userId);
  io.to(`user:${idStr(userId)}`).emit('connection:state', {
    state: payload.state || CONNECTION_STATES.AVAILABLE,
    sessionId: payload.sessionId || null,
    peerId: payload.peerId || null,
  });
}

module.exports = {
  CONNECTION_STATES,
  isBusy,
  isBusyAsync,
  isBusyState,
  getState,
  markAvailable,
  claimForSession,
  setSessionParticipants,
  upgradeCall,
  downgradeToChat,
  releaseSession,
  reconcileUser,
  emitToUser,
  peerIdFromSession,
};
