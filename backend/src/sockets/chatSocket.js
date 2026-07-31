const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const ChatSession = require('../models/ChatSession');
const chatService = require('../services/chatService');
const { createNotification } = require('../services/notificationService');
const { validateChatMessage } = require('../utils/chatMessageValidation');

/** Per-session call state: idle | ringing | active */
const sessionCallState = new Map();

function setCallState(sessionId, state) {
  if (!sessionId) return;
  if (state === 'idle') {
    sessionCallState.delete(sessionId);
  } else {
    sessionCallState.set(sessionId, state);
  }
}

function getCallState(sessionId) {
  return sessionCallState.get(sessionId) || 'idle';
}

async function assertSessionParticipant(sessionId, userId) {
  if (!sessionId) return false;
  try {
    const session = await ChatSession.findById(sessionId);
    if (!session || session.status !== 'active') return false;
    return session.hasParticipant(userId);
  } catch {
    return false;
  }
}

const emitMatchPair = async (socket, peerSocket, sessionId, userId, peerUserId) => {
  const [peerForSocket, peerForPeerSocket] = await Promise.all([
    chatService.getPeerProfile(peerUserId),
    chatService.getPeerProfile(userId),
  ]);

  if (!peerForSocket || !peerForPeerSocket) return false;

  socket.emit('match:found', { sessionId, peer: peerForSocket });
  peerSocket.emit('match:found', { sessionId, peer: peerForPeerSocket });

  try {
    await Promise.all([
      createNotification(
        userId,
        'Chat partner found! 💬',
        `You’re connected with ${peerForSocket.name || 'a learner'}. Practice English together!`,
        'chat',
        { key: `chat-match-${sessionId}-${userId}`, data: { route: '/random-chat' } }
      ),
      createNotification(
        peerUserId,
        'Chat partner found! 💬',
        `You’re connected with ${peerForPeerSocket.name || 'a learner'}. Practice English together!`,
        'chat',
        { key: `chat-match-${sessionId}-${peerUserId}`, data: { route: '/random-chat' } }
      ),
    ]);
  } catch (err) {
    console.error('Match notification failed:', err.message || err);
  }

  return true;
};

const configureChatSocket = (io) => {
  // Authentication Middleware for Sockets
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication failed: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select(
        '_id name role region avatar activeDeviceId'
      );

      if (!user) {
        return next(new Error('Authentication failed: User not found'));
      }

      if (user.activeDeviceId) {
        const deviceId =
          socket.handshake.auth?.deviceId ||
          socket.handshake.headers?.['x-device-id'];
        if (!deviceId || String(deviceId) !== String(user.activeDeviceId)) {
          return next(new Error('Authentication failed: Session active on another device'));
        }
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket Auth Error:', err.message);
      return next(new Error('Authentication failed: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`Socket Connected: User ${userId} (${socket.user.name})`);

    // Register user as online
    chatService.registerOnlineUser(userId, socket.id);
    User.findByIdAndUpdate(userId, { isOnline: true, socketId: socket.id }).exec();

    // 1. Join personal room for targeted alerts/notifications
    socket.join(`user:${userId}`);

    // 2. Search for a random match
    socket.on('match:start', async () => {
      console.log(`User ${userId} started matchmaking search`);
      
      // Prevent double entry
      chatService.removeFromWaitingPool(userId);

      // Check if a peer is available in waiting pool
      const peer = chatService.findRandomMatch(userId);

      if (peer) {
        console.log(`Match found between ${userId} and ${peer.userId}`);

        // Remove peer from waiting pool
        chatService.removeFromWaitingPool(peer.userId);

        // Create Chat Session in DB
        const session = await chatService.createSession(userId, peer.userId);
        const sessionId = session._id.toString();

        const peerSocket = io.sockets.sockets.get(peer.socketId);
        
        if (peerSocket) {
          socket.join(`room:${sessionId}`);
          peerSocket.join(`room:${sessionId}`);

          const sent = await emitMatchPair(socket, peerSocket, sessionId, userId, peer.userId);
          if (!sent) {
            await chatService.addToWaitingPool(userId, socket.id);
            socket.emit('match:searching');
          }
        } else {
          // Fallback if peer disconnected right before matching
          await chatService.addToWaitingPool(userId, socket.id);
          socket.emit('match:searching');
        }
      } else {
        // No match found immediately, put user in waiting pool
        await chatService.addToWaitingPool(userId, socket.id);
        socket.emit('match:searching');
      }
    });

    // 3. Send message — only session participants may write
    socket.on('message:send', async ({ sessionId, text, clientId }) => {
      if (!sessionId || !text) return;
      if (!(await assertSessionParticipant(sessionId, userId))) {
        socket.emit('message:rejected', {
          clientId: clientId || null,
          reason: 'forbidden',
          message: 'You are not part of this conversation.',
        });
        return;
      }

      const trimmed = String(text).trim();
      const validation = validateChatMessage(trimmed);
      if (!validation.valid) {
        socket.emit('message:rejected', {
          clientId: clientId || null,
          reason: validation.reason,
          message: validation.message,
        });
        return;
      }

      try {
        const message = new Message({
          chatSession: sessionId,
          sender: userId,
          text: trimmed,
        });
        await message.save();

        const payload = {
          id: message._id,
          text: message.text,
          senderId: userId,
          timestamp: message.timestamp,
        };

        // Delivered ack to sender (single/double tick flow)
        socket.emit('message:delivered', {
          id: message._id.toString(),
          clientId: clientId || null,
          timestamp: message.timestamp,
        });

        // Broadcast to peer in session room
        socket.to(`room:${sessionId}`).emit('message:receive', payload);
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    });

    // Read receipts — peer opened/saw messages
    socket.on('message:seen', async ({ sessionId, messageIds }) => {
      if (!sessionId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;

      socket.to(`room:${sessionId}`).emit('message:seen', {
        messageIds,
        readerId: userId,
      });
    });

    // 4. Typing indicators
    socket.on('typing:start', async ({ sessionId }) => {
      if (!sessionId) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;
      socket.to(`room:${sessionId}`).emit('peer:typing', { isTyping: true });
    });

    socket.on('typing:stop', async ({ sessionId }) => {
      if (!sessionId) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;
      socket.to(`room:${sessionId}`).emit('peer:typing', { isTyping: false });
    });

    // 5. Skip current chat partner / disconnect from session
    socket.on('chat:skip', async ({ sessionId }) => {
      if (!sessionId) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;
      console.log(`User ${userId} requested skip for session ${sessionId}`);

      try {
        await chatService.endSession(sessionId, userId);
        setCallState(sessionId, 'idle');

        // Notify peer they were skipped
        socket.to(`room:${sessionId}`).emit('peer:disconnected');

        // Make current socket leave session room
        socket.leave(`room:${sessionId}`);

        // Automatically place this user back in waiting pool to look for next match
        socket.emit('match:searching');
        const peer = chatService.findRandomMatch(userId);

        if (peer) {
          chatService.removeFromWaitingPool(peer.userId);
          const newSession = await chatService.createSession(userId, peer.userId);
          const newSessionId = newSession._id.toString();
          const peerSocket = io.sockets.sockets.get(peer.socketId);

          if (peerSocket) {
            socket.join(`room:${newSessionId}`);
            peerSocket.join(`room:${newSessionId}`);

            const sent = await emitMatchPair(
              socket,
              peerSocket,
              newSessionId,
              userId,
              peer.userId
            );
            if (!sent) {
              await chatService.addToWaitingPool(userId, socket.id);
            }
          } else {
            await chatService.addToWaitingPool(userId, socket.id);
          }
        } else {
          await chatService.addToWaitingPool(userId, socket.id);
        }
      } catch (err) {
        console.error('Skip error:', err);
      }
    });

    // 6. Video practice + WebRTC signaling (participant-gated)
    socket.on('video:call-start', async ({ sessionId, mode }) => {
      if (!sessionId) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;

      const current = getCallState(sessionId);
      if (current !== 'idle') {
        socket.emit('video:call-busy', { sessionId });
        return;
      }

      setCallState(sessionId, 'ringing');
      const callMode = mode === 'voice' ? 'voice' : 'video';
      socket.to(`room:${sessionId}`).emit('video:call-incoming', { callerId: userId, mode: callMode });
    });

    socket.on('video:call-accept', async ({ sessionId, mode }) => {
      if (!sessionId) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;

      setCallState(sessionId, 'active');
      const callMode = mode === 'voice' ? 'voice' : 'video';
      socket.to(`room:${sessionId}`).emit('video:call-accepted', { acceptorId: userId, mode: callMode });
    });

    socket.on('video:call-reject', async ({ sessionId }) => {
      if (!sessionId) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;

      setCallState(sessionId, 'idle');
      socket.to(`room:${sessionId}`).emit('video:call-rejected', { rejectorId: userId });

      try {
        const session = await ChatSession.findById(sessionId).select('participants');
        const peerId = (session?.participants || [])
          .map((p) => String(p))
          .find((id) => id !== String(userId));
        if (peerId) {
          const rejectorName = socket.user?.name || 'a learner';
          await createNotification(
            peerId,
            'Missed Call in English',
            `${rejectorName} couldn’t take your call. Try Call in English again when they’re free.`,
            'call',
            {
              key: `missed-call-${sessionId}-${Date.now()}`,
              data: { route: '/random-chat?intent=call' },
            }
          );
        }
      } catch (err) {
        console.error('Missed-call notification failed:', err.message || err);
      }
    });

    socket.on('video:call-end', async ({ sessionId }) => {
      if (!sessionId) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;

      setCallState(sessionId, 'idle');
      socket.to(`room:${sessionId}`).emit('video:call-ended', { enderId: userId });
    });

    socket.on('webrtc:offer', async ({ sessionId, offer, mode }) => {
      if (!sessionId || !offer) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;
      if (getCallState(sessionId) !== 'active') return;

      const sdp = typeof offer === 'object' && offer.sdp ? String(offer.sdp) : '';
      if (sdp.length > 50_000) return;

      const callMode = mode === 'voice' ? 'voice' : 'video';
      socket.to(`room:${sessionId}`).emit('webrtc:offer', { offer, senderId: userId, mode: callMode });
    });

    socket.on('webrtc:answer', async ({ sessionId, answer }) => {
      if (!sessionId || !answer) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;
      if (getCallState(sessionId) !== 'active') return;

      const sdp = typeof answer === 'object' && answer.sdp ? String(answer.sdp) : '';
      if (sdp.length > 50_000) return;

      socket.to(`room:${sessionId}`).emit('webrtc:answer', { answer, senderId: userId });
    });

    socket.on('webrtc:ice-candidate', async ({ sessionId, candidate }) => {
      if (!sessionId || !candidate) return;
      if (!(await assertSessionParticipant(sessionId, userId))) return;
      if (getCallState(sessionId) !== 'active') return;

      socket.to(`room:${sessionId}`).emit('webrtc:ice-candidate', { candidate, senderId: userId });
    });

    // 8. Manual leave matching search queue
    socket.on('match:cancel', () => {
      console.log(`User ${userId} cancelled matching queue`);
      chatService.removeFromWaitingPool(userId);
      socket.emit('match:idle');
    });

    // 8. Handle Disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket Disconnected: User ${userId}`);
      
      // Remove from matchmaking waiting queue
      chatService.unregisterOnlineUser(userId);
      
      // Update online status in db
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        socketId: null,
        lastSeen: new Date(),
      });

      // Find any active session of this user and end it
      try {
        const activeSession = await ChatSession.findOne({
          participants: userId,
          status: 'active',
        });

        if (activeSession) {
          const sessionId = activeSession._id.toString();
          setCallState(sessionId, 'idle');
          await chatService.endSession(sessionId, userId);

          // Inform peer user they disconnected
          socket.to(`room:${sessionId}`).emit('peer:disconnected');
        }
      } catch (err) {
        console.error('Disconnect session cleanup failure:', err);
      }
    });
  });
};

module.exports = configureChatSocket;
