const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'ended'],
      default: 'active',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Helper to check if a user is in this session
chatSessionSchema.methods.hasParticipant = function (userId) {
  return this.participants.some(p => p.toString() === userId.toString());
};

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

module.exports = ChatSession;
