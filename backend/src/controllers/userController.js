const User = require('../models/User');
const GameProgress = require('../models/GameProgress');
const CourseProgress = require('../models/CourseProgress');
const uploadService = require('../services/uploadService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isUserProfileComplete } = require('../utils/profileUtils');

/**
 * Get authenticated user profile
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-refreshTokens');
  res.status(200).json(new ApiResponse(200, user, 'Profile retrieved successfully'));
});

/**
 * Update user profile details
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, gender, region, level, referralCode } = req.body;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (gender !== undefined) updateData.gender = gender;
  if (region !== undefined) updateData.region = region;
  if (level !== undefined) updateData.level = level;
  if (referralCode !== undefined) updateData.referralCode = referralCode;

  if (isUserProfileComplete({ ...req.user.toObject(), ...updateData })) {
    updateData.profileCompleted = true;
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-refreshTokens');

  res.status(200).json(new ApiResponse(200, updatedUser, 'Profile updated successfully'));
});

/**
 * Upload and update user avatar image (local disk)
 */
const updateAvatar = asyncHandler(async (req, res) => {
  const uploadResult = uploadService.saveAvatar(req);

  const user = await User.findById(req.user._id);
  if (user.avatar) {
    uploadService.deleteLocalAsset(user.avatar);
  }

  user.avatar = uploadResult.url;
  await user.save();

  res.status(200).json(
    new ApiResponse(
      200,
      { avatar: uploadResult.url },
      'Avatar updated successfully'
    )
  );
});

/**
 * Get detailed stats / performance metrics for dashboard dashboard
 */
const getStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Get all game progress
  const gameProgress = await GameProgress.find({ user: userId });
  
  // 2. Get course completion progress
  const courseProgress = await CourseProgress.findOne({ user: userId });
  const completedLessonsCount = courseProgress ? courseProgress.completedLessons.length : 0;

  // Aggregate game statistics
  let totalScore = 0;
  let totalCorrect = 0;
  let totalAttempts = 0;
  
  const gamesBreakdown = gameProgress.map((game) => {
    totalScore += game.score;
    totalAttempts += game.stats.totalAttempts || 0;
    totalCorrect += game.stats.correctAnswers || 0;
    
    return {
      gameId: game.gameId,
      level: game.level,
      score: game.score,
      correct: game.stats.correctAnswers,
      attempts: game.stats.totalAttempts,
      accuracy: game.stats.accuracy,
    };
  });

  const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 100;

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalScore,
        overallAccuracy,
        completedLessonsCount,
        gamesBreakdown,
        lastLessonId: courseProgress ? courseProgress.lastLessonId : null,
      },
      'User stats retrieved successfully'
    )
  );
});

module.exports = {
  getMe,
  updateProfile,
  updateAvatar,
  getStats,
};
