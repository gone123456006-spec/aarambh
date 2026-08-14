const mongoose = require('mongoose');

/**
 * Game level configuration: manage max levels per game and metadata
 */
const gameLevelSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      enum: ['quiz', 'scramble', 'fill', 'flash'],
      required: true,
      unique: true,
      index: true,
    },
    maxLevel: {
      type: Number,
      required: true,
      default: 50,
      min: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    pointsPerCorrect: {
      type: Number,
      default: 5,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Get or create default level config for a game
 */
gameLevelSchema.statics.getOrCreateConfig = async function (gameId) {
  let config = await this.findOne({ gameId });
  
  if (!config) {
    const defaults = {
      quiz: { maxLevel: 50, description: 'Quiz Challenge - Vocabulary & Grammar' },
      scramble: { maxLevel: 50, description: 'Word Scramble - Unscramble Words' },
      fill: { maxLevel: 100, description: 'Fill in the Blank - Grammar Practice' },
      flash: { maxLevel: 50, description: 'Flash Cards - Learn New Words' },
    };
    
    const defaultConfig = defaults[gameId] || { maxLevel: 50, description: 'Game Level' };
    
    config = await this.create({
      gameId,
      ...defaultConfig,
    });
  }
  
  return config;
};

const GameLevel = mongoose.model('GameLevel', gameLevelSchema);

module.exports = GameLevel;
