const mongoose = require('mongoose');

/**
 * Polymorphic game question schema supporting all game types:
 * - quiz: multiple choice questions with options and answer
 * - scramble: word scrambles with hints
 * - fill: fill-in-the-blank with options, answer, and grammar rule
 * - flash: flashcards with word, meaning, and example
 */
const gameQuestionSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      enum: ['quiz', 'scramble', 'fill', 'flash'],
      required: true,
      index: true,
    },
    level: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Quiz fields
    question: {
      type: String,
      trim: true,
    },
    options: {
      type: [String],
    },
    answer: {
      type: Number,
    },
    explanation: {
      type: String,
      trim: true,
    },
    // Scramble fields
    word: {
      type: String,
      trim: true,
      uppercase: true,
    },
    hint: {
      type: String,
      trim: true,
    },
    // Fill-in-the-blank fields
    sentence: {
      type: String,
      trim: true,
    },
    correctText: {
      type: String,
      trim: true,
    },
    rule: {
      type: String,
      trim: true,
    },
    // Flashcard fields
    meaning: {
      type: String,
      trim: true,
    },
    example: {
      type: String,
      trim: true,
    },
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries by game and level
gameQuestionSchema.index({ gameId: 1, level: 1, order: 1, active: 1 });

/**
 * Validation: ensure required fields for each game type
 */
gameQuestionSchema.pre('save', function (next) {
  const doc = this;

  if (doc.gameId === 'quiz') {
    if (!doc.question?.trim()) {
      return next(new Error('Quiz questions must have a question text'));
    }
    if (!Array.isArray(doc.options) || doc.options.length < 2) {
      return next(new Error('Quiz questions must have at least 2 options'));
    }
    if (doc.answer == null || doc.answer < 0 || doc.answer >= doc.options.length) {
      return next(new Error('Quiz questions must have a valid answer index'));
    }
  } else if (doc.gameId === 'scramble') {
    if (!doc.word?.trim()) {
      return next(new Error('Scramble questions must have a word'));
    }
    if (!doc.hint?.trim()) {
      return next(new Error('Scramble questions must have a hint'));
    }
  } else if (doc.gameId === 'fill') {
    if (!doc.sentence?.trim()) {
      return next(new Error('Fill-blank questions must have a sentence'));
    }
    if (!Array.isArray(doc.options) || doc.options.length < 2) {
      return next(new Error('Fill-blank questions must have at least 2 options'));
    }
    if (doc.answer == null || doc.answer < 0 || doc.answer >= doc.options.length) {
      return next(new Error('Fill-blank questions must have a valid answer index'));
    }
    if (!doc.correctText?.trim()) {
      return next(new Error('Fill-blank questions must have correctText'));
    }
  } else if (doc.gameId === 'flash') {
    if (!doc.word?.trim()) {
      return next(new Error('Flashcards must have a word'));
    }
    if (!doc.meaning?.trim()) {
      return next(new Error('Flashcards must have a meaning'));
    }
    if (!doc.example?.trim()) {
      return next(new Error('Flashcards must have an example'));
    }
  }

  next();
});

/**
 * Format question for frontend based on game type
 */
gameQuestionSchema.methods.toFrontend = function () {
  const doc = this.toObject();
  delete doc.createdBy;
  delete doc.createdAt;
  delete doc.updatedAt;
  delete doc.__v;

  if (doc.gameId === 'quiz') {
    return {
      id: doc._id,
      q: doc.question,
      options: doc.options,
      answer: doc.answer,
      explanation: doc.explanation,
      level: doc.level,
    };
  } else if (doc.gameId === 'scramble') {
    return {
      id: doc._id,
      word: doc.word,
      hint: doc.hint,
      level: doc.level,
    };
  } else if (doc.gameId === 'fill') {
    return {
      id: doc._id,
      sentence: doc.sentence,
      options: doc.options,
      answer: doc.answer,
      correctText: doc.correctText,
      rule: doc.rule,
      level: doc.level,
    };
  } else if (doc.gameId === 'flash') {
    return {
      id: doc._id,
      word: doc.word,
      meaning: doc.meaning,
      example: doc.example,
      level: doc.level,
    };
  }

  return doc;
};

const GameQuestion = mongoose.model('GameQuestion', gameQuestionSchema);

module.exports = GameQuestion;
