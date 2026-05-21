const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get global leaderboard rankings
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  // Use aggregation to join users and their total game scores
  const leaderboard = await User.aggregate([
    {
      $lookup: {
        from: 'gameprogresses', // matches mongoose lowercased plural name
        localField: '_id',
        foreignField: 'user',
        as: 'games',
      },
    },
    {
      $addFields: {
        points: { $sum: '$games.score' },
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        name: { $ifNull: ['$name', 'Anonymous'] },
        location: { $ifNull: ['$region', ''] },
        points: { $ifNull: ['$points', 0] },
      },
    },
    {
      $sort: { points: -1 },
    },
  ]);

  // Map rank values
  const ranked = leaderboard.map((user, index) => ({
    ...user,
    rank: index + 1,
  }));

  res.status(200).json(new ApiResponse(200, ranked, 'Leaderboard retrieved successfully'));
});

module.exports = {
  getLeaderboard,
};
