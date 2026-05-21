const GameProgress = require('../models/GameProgress');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get progress for all games
 */
const getGameProgress = asyncHandler(async (req, res) => {
  const progresses = await GameProgress.find({ user: req.user._id });
  
  // Format as a keyed object for easy client-side lookup
  const formatted = {
    quiz: { level: 0, score: 0, completed: false },
    scramble: { level: 0, score: 0, completed: false },
    fill: { level: 0, score: 0, completed: false },
    flash: { level: 0, score: 0, completed: false },
  };

  progresses.forEach((p) => {
    if (formatted[p.gameId]) {
      formatted[p.gameId] = {
        level: p.level,
        score: p.score,
        completed: p.completed,
        stats: p.stats,
      };
    }
  });

  res.status(200).json(new ApiResponse(200, formatted, 'Game progress retrieved successfully'));
});

/**
 * Save game level + score progress
 */
const saveGameProgress = asyncHandler(async (req, res) => {
  const { gameId, level, score, completed } = req.body;

  if (!gameId) {
    throw new ApiError(400, 'Game ID is required');
  }

  let progress = await GameProgress.findOne({ user: req.user._id, gameId });

  if (!progress) {
    progress = new GameProgress({
      user: req.user._id,
      gameId,
    });
  }

  if (level !== undefined) progress.level = level;
  if (score !== undefined) progress.score = score;
  if (completed !== undefined) progress.completed = completed;

  await progress.save();

  res.status(200).json(new ApiResponse(200, progress, 'Game progress saved successfully'));
});

/**
 * Record an answer (correct or wrong) to calculate accuracy and stats
 */
const recordAnswer = asyncHandler(async (req, res) => {
  const { gameId, isCorrect } = req.body;

  if (!gameId || isCorrect === undefined) {
    throw new ApiError(400, 'Game ID and isCorrect parameters are required');
  }

  let progress = await GameProgress.findOne({ user: req.user._id, gameId });

  if (!progress) {
    progress = new GameProgress({
      user: req.user._id,
      gameId,
    });
  }

  // Update statistics
  progress.stats.totalAttempts += 1;
  if (isCorrect) {
    progress.stats.correctAnswers += 1;
  }

  // Calculate accuracy percentage
  if (progress.stats.totalAttempts > 0) {
    progress.stats.accuracy = Math.round(
      (progress.stats.correctAnswers / progress.stats.totalAttempts) * 100
    );
  }

  await progress.save();

  res.status(200).json(new ApiResponse(200, progress, 'Answer registered successfully'));
});

/**
 * Retrieve user's total aggregate score across all games
 */
const getTotalScore = asyncHandler(async (req, res) => {
  const progresses = await GameProgress.find({ user: req.user._id });
  
  const totalScore = progresses.reduce((sum, p) => sum + (p.score || 0), 0);

  res.status(200).json(
    new ApiResponse(
      200,
      { totalScore },
      'Total game score retrieved successfully'
    )
  );
});

module.exports = {
  getGameProgress,
  saveGameProgress,
  recordAnswer,
  getTotalScore,
};
