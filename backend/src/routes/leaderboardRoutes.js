const express = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, leaderboardController.getLeaderboard);

module.exports = router;
