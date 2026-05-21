const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get message history for a specific chat session
 */
const getHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user._id;

  const session = await ChatSession.findById(sessionId);
  if (!session) {
    throw new ApiError(404, 'Chat session not found');
  }

  // Ensure user is participant in this session
  if (!session.hasParticipant(userId)) {
    throw new ApiError(403, 'You are not authorized to view this session history');
  }

  const messages = await Message.find({ chatSession: sessionId })
    .populate('sender', 'name avatar')
    .sort({ timestamp: 1 });

  res.status(200).json(new ApiResponse(200, messages, 'Chat history retrieved successfully'));
});

/**
 * List all past chat sessions for the authenticated user
 */
const getSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const sessions = await ChatSession.find({
    participants: userId,
  })
    .populate('participants', 'name region avatar')
    .sort({ startedAt: -1 });

  res.status(200).json(new ApiResponse(200, sessions, 'Chat sessions retrieved successfully'));
});

module.exports = {
  getHistory,
  getSessions,
};
