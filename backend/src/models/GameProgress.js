const mongoose = require('mongoose');

const gameProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gameId: {
      type: String,
      enum: ['quiz', 'scramble', 'fill', 'flash'],
      required: true,
    },
    level: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    stats: {
      totalAttempts: {
        type: Number,
        default: 0,
      },
      correctAnswers: {
        type: Number,
        default: 0,
      },
      accuracy: {
        type: Number,
        default: 100, // percentage (0-100)
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index so user has exactly one progress document per game
gameProgressSchema.index({ user: 1, gameId: 1 }, { unique: true });

const GameProgress = mongoose.model('GameProgress', gameProgressSchema);

module.exports = GameProgress;
