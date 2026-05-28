const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const ChatSession = require('../models/ChatSession');
const chatService = require('../services/chatService');
const { createNotification } = require('../services/notificationService');

const emitMatchPair = async (socket, peerSocket, sessionId, userId, peerUserId) => {
  const [peerForSocket, peerForPeerSocket] = await Promise.all([
    chatService.getPeerProfile(peerUserId),
    chatService.getPeerProfile(userId),
  ]);

  if (!peerForSocket || !peerForPeerSocket) return false;

  socket.emit('match:found', { sessionId, peer: peerForSocket });
  peerSocket.emit('match:found', { sessionId, peer: peerForPeerSocket });
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
      const user = await User.findById(decoded.id).select('_id name role region avatar');

      if (!user) {
        return next(new Error('Authentication failed: User not found'));
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

    // 3. Send message
    socket.on('message:send', async ({ sessionId, text, clientId }) => {
      if (!sessionId || !text) return;

      try {
        const message = new Message({
          chatSession: sessionId,
          sender: userId,
          text: text.trim(),
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
    socket.on('message:seen', ({ sessionId, messageIds }) => {
      if (!sessionId || !Array.isArray(messageIds) || messageIds.length === 0) return;

      socket.to(`room:${sessionId}`).emit('message:seen', {
        messageIds,
        readerId: userId,
      });
    });

    // 4. Typing indicators
    socket.on('typing:start', ({ sessionId }) => {
      socket.to(`room:${sessionId}`).emit('peer:typing', { isTyping: true });
    });

    socket.on('typing:stop', ({ sessionId }) => {
      socket.to(`room:${sessionId}`).emit('peer:typing', { isTyping: false });
    });

    // 5. Skip current chat partner / disconnect from session
    socket.on('chat:skip', async ({ sessionId }) => {
      if (!sessionId) return;
      console.log(`User ${userId} requested skip for session ${sessionId}`);

      try {
        await chatService.endSession(sessionId);

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

    // 6. Video practice room (real users in same session — camera on/off signals)
    socket.on('video:join', ({ sessionId }) => {
      if (!sessionId) return;
      socket.to(`room:${sessionId}`).emit('video:peer-joined', { userId });
    });

    socket.on('video:leave', ({ sessionId }) => {
      if (!sessionId) return;
      socket.to(`room:${sessionId}`).emit('video:peer-left', { userId });
    });

    // 7. Manual leave matching search queue
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
          await chatService.endSession(sessionId);

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
