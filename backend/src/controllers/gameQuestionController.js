const GameQuestion = require('../models/GameQuestion');
const GameLevel = require('../models/GameLevel');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all questions for a specific game (admin)
 */
const getGameQuestions = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const { level, difficulty, active } = req.query;

  const query = { gameId };

  if (level) query.level = parseInt(level, 10);
  if (difficulty) query.difficulty = difficulty;
  if (active !== undefined) query.active = active === 'true';

  const questions = await GameQuestion.find(query)
    .sort({ level: 1, order: 1, createdAt: 1 })
    .lean();

  const levelConfig = await GameLevel.getOrCreateConfig(gameId);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        questions,
        levelConfig,
      },
      'Game questions retrieved successfully'
    )
  );
});

/**
 * Get questions for a specific game and level (frontend)
 */
const getQuestionsByLevel = asyncHandler(async (req, res) => {
  const { gameId, level } = req.params;

  const questions = await GameQuestion.find({
    gameId,
    level: parseInt(level, 10),
    active: true,
  })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  const formatted = questions.map((q) => {
    const doc = new GameQuestion(q);
    return doc.toFrontend();
  });

  res.status(200).json(
    new ApiResponse(200, formatted, 'Questions retrieved successfully')
  );
});

/**
 * Create a new game question (admin)
 */
const createGameQuestion = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const questionData = { ...req.body, gameId, createdBy: req.user._id };

  // Validate level config
  const levelConfig = await GameLevel.getOrCreateConfig(gameId);
  if (questionData.level && questionData.level > levelConfig.maxLevel) {
    throw new ApiError(
      400,
      `Level ${questionData.level} exceeds max level ${levelConfig.maxLevel} for ${gameId}`
    );
  }

  const question = new GameQuestion(questionData);
  await question.save();

  res.status(201).json(
    new ApiResponse(201, question, 'Game question created successfully')
  );
});

/**
 * Update an existing game question (admin)
 */
const updateGameQuestion = asyncHandler(async (req, res) => {
  const { gameId, questionId } = req.params;
  const updates = req.body;

  const question = await GameQuestion.findOne({ _id: questionId, gameId });

  if (!question) {
    throw new ApiError(404, 'Question not found');
  }

  // Validate level if changed
  if (updates.level) {
    const levelConfig = await GameLevel.getOrCreateConfig(gameId);
    if (updates.level > levelConfig.maxLevel) {
      throw new ApiError(
        400,
        `Level ${updates.level} exceeds max level ${levelConfig.maxLevel} for ${gameId}`
      );
    }
  }

  // Update fields
  Object.keys(updates).forEach((key) => {
    if (key !== '_id' && key !== 'gameId' && key !== 'createdBy') {
      question[key] = updates[key];
    }
  });

  await question.save();

  res.status(200).json(
    new ApiResponse(200, question, 'Game question updated successfully')
  );
});

/**
 * Delete a game question (admin)
 */
const deleteGameQuestion = asyncHandler(async (req, res) => {
  const { gameId, questionId } = req.params;

  const question = await GameQuestion.findOneAndDelete({ _id: questionId, gameId });

  if (!question) {
    throw new ApiError(404, 'Question not found');
  }

  res.status(200).json(
    new ApiResponse(200, null, 'Game question deleted successfully')
  );
});

/**
 * Bulk create game questions (admin)
 */
const bulkCreateQuestions = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const { questions } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new ApiError(400, 'Questions array is required');
  }

  const levelConfig = await GameLevel.getOrCreateConfig(gameId);

  const formatted = questions.map((q) => ({
    ...q,
    gameId,
    createdBy: req.user._id,
  }));

  // Validate all levels
  for (const q of formatted) {
    if (q.level && q.level > levelConfig.maxLevel) {
      throw new ApiError(
        400,
        `Level ${q.level} exceeds max level ${levelConfig.maxLevel} for ${gameId}`
      );
    }
  }

  const created = await GameQuestion.insertMany(formatted, { ordered: false });

  res.status(201).json(
    new ApiResponse(
      201,
      created,
      `${created.length} game questions created successfully`
    )
  );
});

/**
 * Get game level configuration (admin + frontend)
 */
const getGameLevelConfig = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const config = await GameLevel.getOrCreateConfig(gameId);

  res.status(200).json(
    new ApiResponse(200, config, 'Game level config retrieved successfully')
  );
});

/**
 * Update game level configuration (admin)
 */
const updateGameLevelConfig = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const { maxLevel, description, pointsPerCorrect } = req.body;

  let config = await GameLevel.findOne({ gameId });

  if (!config) {
    config = new GameLevel({ gameId, updatedBy: req.user._id });
  }

  if (maxLevel !== undefined) {
    if (maxLevel < 1) {
      throw new ApiError(400, 'Max level must be at least 1');
    }
    config.maxLevel = maxLevel;
  }

  if (description !== undefined) config.description = description;
  if (pointsPerCorrect !== undefined) config.pointsPerCorrect = pointsPerCorrect;
  config.updatedBy = req.user._id;

  await config.save();

  res.status(200).json(
    new ApiResponse(200, config, 'Game level config updated successfully')
  );
});

/**
 * Get question count by level for a game (admin)
 */
const getQuestionStats = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const stats = await GameQuestion.aggregate([
    { $match: { gameId, active: true } },
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 },
        difficulties: { $addToSet: '$difficulty' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const levelConfig = await GameLevel.getOrCreateConfig(gameId);
  const total = await GameQuestion.countDocuments({ gameId, active: true });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        gameId,
        total,
        maxLevel: levelConfig.maxLevel,
        byLevel: stats.map((s) => ({
          level: s._id,
          count: s.count,
          difficulties: s.difficulties,
        })),
      },
      'Question stats retrieved successfully'
    )
  );
});

module.exports = {
  getGameQuestions,
  getQuestionsByLevel,
  createGameQuestion,
  updateGameQuestion,
  deleteGameQuestion,
  bulkCreateQuestions,
  getGameLevelConfig,
  updateGameLevelConfig,
  getQuestionStats,
};
